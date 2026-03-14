import * as lancedb from "@lancedb/lancedb";
import { getClient } from "./client";
import { withRetry } from "./retry";
import type { OnProgress } from "./types";

export type StructifyStepName = "数据处理" | "向量存储";

export interface StructifyProgressEvent {
  step: StructifyStepName;
  status: "running" | "done" | "error" | "retry";
  message: string;
  data?: Record<string, unknown>;
}

export interface IngestInput {
  /** 原始数据，什么格式都行：聊天记录、个人描述、评价、简历文本等 */
  raw: string;
  /** 可选：数据来源标识 */
  source?: string;
}

export interface AuntieProfile {
  id: string;
  /** LLM 整理后的描述文本（用于向量搜索） */
  text: string;
  /** LLM 提取的姓名 */
  name: string;
  /** LLM 提取的关键信息，半结构化 JSON */
  profile: Record<string, unknown>;
  /** 数据来源 */
  source: string;
  /** 向量 */
  vector: number[];
}

export interface SearchResult {
  id: string;
  name: string;
  text: string;
  profile: Record<string, unknown>;
  score: number;
}

let db: lancedb.Connection | null = null;
const DB_PATH = "./swan-data";
const TABLE_NAME = "aunties";

/** 获取或创建数据库连接 */
async function getDb(): Promise<lancedb.Connection> {
  if (!db) {
    db = await lancedb.connect(DB_PATH);
  }
  return db;
}

/** 获取 embedding 向量 */
async function getEmbedding(text: string): Promise<number[]> {
  const { client } = getClient("fast");

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * 导入数据 — 把乱七八糟的原始数据扔进来，LLM 处理后存入 LanceDB
 *
 * 流程：原始数据 → LLM 提取结构化描述 → 生成向量 → 存入 LanceDB
 */
export async function ingest(
  inputs: IngestInput[],
  onProgress?: (event: StructifyProgressEvent) => void,
): Promise<AuntieProfile[]> {
  const emit = onProgress ?? (() => {});
  const profiles: AuntieProfile[] = [];

  // === 第一步：LLM 处理每条数据 ===
  emit({ step: "数据处理", status: "running", message: `正在处理 ${inputs.length} 条数据...` });

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    emit({ step: "数据处理", status: "running", message: `处理第 ${i + 1}/${inputs.length} 条...` });

    try {
      const result = await withRetry(
        () => extractProfile(input.raw),
        { timeoutMs: 30_000 },
      );

      // 生成向量
      const vector = await withRetry(
        () => getEmbedding(result.text),
        { timeoutMs: 15_000 },
      );

      const profile: AuntieProfile = {
        id: `auntie-${Date.now()}-${i}`,
        text: result.text,
        name: result.name,
        profile: result.profile,
        source: input.source ?? "unknown",
        vector,
      };

      profiles.push(profile);
    } catch (err) {
      emit({ step: "数据处理", status: "error", message: `第 ${i + 1} 条处理失败: ${(err as Error).message}` });
    }
  }

  emit({ step: "数据处理", status: "done", message: `成功处理 ${profiles.length}/${inputs.length} 条`, data: { count: profiles.length } });

  if (profiles.length === 0) return profiles;

  // === 第二步：存入 LanceDB ===
  emit({ step: "向量存储", status: "running", message: "正在存入向量数据库..." });

  try {
    const database = await getDb();

    // 准备存储数据
    const records = profiles.map((p) => ({
      id: p.id,
      text: p.text,
      name: p.name,
      profile: JSON.stringify(p.profile),
      source: p.source,
      vector: p.vector,
    }));

    // 尝试追加到已有表，如果不存在则创建
    try {
      const table = await database.openTable(TABLE_NAME);
      await table.add(records);
    } catch {
      await database.createTable(TABLE_NAME, records);
    }

    emit({ step: "向量存储", status: "done", message: `已存入 ${profiles.length} 条记录` });
  } catch (err) {
    emit({ step: "向量存储", status: "error", message: `存储失败: ${(err as Error).message}` });
  }

  return profiles;
}

/**
 * 语义搜索 — 用自然语言查找匹配的阿姨
 */
export async function search(query: string, limit = 5): Promise<SearchResult[]> {
  const database = await getDb();

  // 生成查询向量
  const queryVector = await getEmbedding(query);

  const table = await database.openTable(TABLE_NAME);
  const results = await table
    .search(queryVector)
    .limit(limit)
    .toArray();

  return results.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    text: r.text as string,
    profile: JSON.parse(r.profile as string),
    score: r._distance as number,
  }));
}

// === 内部实现 ===

/** LLM 从原始数据中提取结构化信息 */
async function extractProfile(raw: string): Promise<{ name: string; text: string; profile: Record<string, unknown> }> {
  const { client, model } = getClient("fast");

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: `以下是一段关于家政服务人员的原始数据，请提取并整理成结构化信息。

原始数据：
${raw}

请输出 JSON 格式，包含以下字段：
{
  "name": "姓名（如果没有就写'未知'）",
  "text": "用一段话描述这个人的核心信息，包括技能、经验、特点等（用于搜索匹配）",
  "profile": {
    "age": "年龄（数字或null）",
    "skills": ["技能列表"],
    "experience_years": "从业年限（数字或null）",
    "region": "服务区域",
    "certificates": ["证书列表"],
    "specialties": ["擅长领域"],
    "personality": "性格特点",
    "rating": "评价摘要",
    "other": "其他重要信息"
  }
}

只输出 JSON，不要解释。`,
      },
    ],
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("模型返回为空");

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("未找到 JSON: " + content.slice(0, 100));

  return JSON.parse(jsonMatch[0]);
}
