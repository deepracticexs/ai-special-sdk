import { getClient } from "./client";
import { withRetry } from "./retry";
import { search } from "./structify";
import type { SearchResult } from "./structify";
import type { OnProgress } from "./types";

export type MatchStepName = "候选搜索" | "智能评估";

export interface MatchProgressEvent {
  step: MatchStepName;
  status: "running" | "done" | "error";
  message: string;
  data?: Record<string, unknown>;
}

export interface MatchResult {
  /** 推荐排名 */
  rank: number;
  /** 阿姨姓名 */
  name: string;
  /** 推荐理由（站在用户角度） */
  reason: string;
  /** 匹配度评分 1-10 */
  score: number;
  /** 原始档案 */
  profile: Record<string, unknown>;
}

export interface MatchOutput {
  /** 用户的原始需求 */
  query: string;
  /** 排序后的推荐结果 */
  results: MatchResult[];
}

/**
 * 智能匹配 — 用自然语言描述需求，AI 评估推荐
 *
 * 两步：LanceDB 语义搜索候选 → Sonnet 评估排序给理由
 */
export async function match(
  query: string,
  onProgress?: (event: MatchProgressEvent) => void,
  limit = 5,
): Promise<MatchOutput> {
  const emit = onProgress ?? (() => {});

  // === 第一步：向量搜索候选 ===
  emit({ step: "候选搜索", status: "running", message: "正在从数据库中搜索候选人..." });

  let candidates: SearchResult[];
  try {
    candidates = await search(query, limit);
    emit({ step: "候选搜索", status: "done", message: `找到 ${candidates.length} 位候选人`, data: { count: candidates.length } });
  } catch (err) {
    emit({ step: "候选搜索", status: "error", message: `搜索失败: ${(err as Error).message}` });
    return { query, results: [] };
  }

  if (candidates.length === 0) {
    return { query, results: [] };
  }

  // === 第二步：AI 评估推荐 ===
  emit({ step: "智能评估", status: "running", message: "AI 正在评估推荐..." });

  try {
    const results = await withRetry(
      () => evaluate(query, candidates),
      { timeoutMs: 30_000 },
    );
    emit({ step: "智能评估", status: "done", message: `评估完成，推荐 ${results.length} 位`, data: { results: results as unknown as Record<string, unknown> } });
    return { query, results };
  } catch (err) {
    emit({ step: "智能评估", status: "error", message: `评估失败: ${(err as Error).message}` });
    // 降级：直接用搜索距离排序，不给理由
    return {
      query,
      results: candidates.map((c, i) => ({
        rank: i + 1,
        name: c.name,
        reason: "（AI 评估暂时不可用）",
        score: Math.round((2 - Math.min(c.score, 2)) * 5),
        profile: c.profile,
      })),
    };
  }
}

// === 内部实现 ===

async function evaluate(query: string, candidates: SearchResult[]): Promise<MatchResult[]> {
  const { client, model } = getClient("text");

  const candidateList = candidates.map((c, i) =>
    `候选人 ${i + 1}：${c.name}\n描述：${c.text}`
  ).join("\n\n");

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: `你是一个家政服务顾问。用户提出了一个需求，请根据候选人信息进行评估推荐。

用户需求：${query}

${candidateList}

请按推荐优先级排序，输出 JSON 数组：
[
  {
    "rank": 1,
    "name": "姓名",
    "score": 8,
    "reason": "站在用户角度的推荐理由，说明为什么这个人最适合用户的需求"
  }
]

评分 1-10，10 分最匹配。reason 要具体、有说服力，让用户觉得你真的理解他的需求。
只输出 JSON 数组，不要解释。`,
      },
    ],
    temperature: 0.5,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("模型返回为空");

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("未找到 JSON: " + content.slice(0, 100));

  const parsed = JSON.parse(jsonMatch[0]) as Array<{ rank: number; name: string; score: number; reason: string }>;

  // 合并 profile 信息
  return parsed.map((item) => {
    const candidate = candidates.find((c) => c.name === item.name);
    return {
      rank: item.rank,
      name: item.name,
      score: item.score,
      reason: item.reason,
      profile: candidate?.profile ?? {},
    };
  });
}
