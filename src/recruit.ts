import { getClient } from "./client";
import { withRetry } from "./retry";
import type {
  RecruitInput,
  RecruitOutput,
  RecruitCopy,
  OnProgress,
} from "./types";

const PLATFORM_STYLES: Record<string, string> = {
  小红书: "小红书风格：标题带 emoji，语气种草感，适当用「姐妹」「宝子」等亲切称呼，正文分段短句，结尾带互动引导",
  抖音: "抖音风格：标题抓眼球，口语化，节奏感强，适合配音朗读，突出数字和利益点",
  朋友圈: "朋友圈风格：简短真诚，像朋友分享，不要太营销感，控制在 200 字以内",
  招聘网站: "招聘网站风格：专业正式，条理清晰，分岗位职责和任职要求两部分，突出公司实力",
  公众号: "公众号风格：标题党但不低俗，正文有故事感，中间穿插真实案例或数据，结尾引导关注",
};

/**
 * 招募内容生成 — 一个 API，图文全出
 *
 * 三步串联：
 * 1. Claude 用户需求 → 文案
 * 2. Claude 文案 → 图片提示词
 * 3. Gemini 提示词 → 海报图片
 *
 * 稳定性：每步独立 try/catch + 重试 + 超时 + 降级
 */
export async function recruit(
  input: RecruitInput,
  onProgress?: OnProgress,
): Promise<RecruitOutput> {
  const emit = onProgress ?? (() => {});
  const output: RecruitOutput = { copy: null, imagePrompt: null, imageUrl: null };

  // === 第一步：生成文案 ===
  emit({ step: "文案生成", status: "running", message: `正在生成${input.platform}风格文案...` });

  try {
    output.copy = await withRetry(() => generateCopy(input, "text"), { timeoutMs: 30_000 });
    emit({ step: "文案生成", status: "done", message: "文案生成完成", data: { copy: output.copy as unknown as Record<string, unknown> } });
  } catch (err) {
    emit({ step: "文案生成", status: "error", message: `文案生成失败: ${(err as Error).message}` });
    // 降级到 Gemini
    try {
      emit({ step: "文案生成", status: "retry", message: "降级到备用模型..." });
      output.copy = await withRetry(() => generateCopy(input, "image"), { timeoutMs: 30_000 });
      emit({ step: "文案生成", status: "done", message: "文案生成完成（降级）", data: { copy: output.copy as unknown as Record<string, unknown> } });
    } catch (err2) {
      emit({ step: "文案生成", status: "error", message: `文案彻底失败: ${(err2 as Error).message}` });
    }
  }

  // === 第二步：文案 → 图片提示词 ===
  if (output.copy) {
    emit({ step: "提示词生成", status: "running", message: "正在将文案转化为图片描述..." });
    try {
      output.imagePrompt = await withRetry(() => generateImagePrompt(output.copy!, input, "text"), { timeoutMs: 20_000 });
      emit({ step: "提示词生成", status: "done", message: "图片描述生成完成", data: { imagePrompt: output.imagePrompt } });
    } catch (err) {
      emit({ step: "提示词生成", status: "error", message: `提示词生成失败: ${(err as Error).message}` });
      // 降级到 Gemini
      try {
        emit({ step: "提示词生成", status: "retry", message: "降级到备用模型..." });
        output.imagePrompt = await withRetry(() => generateImagePrompt(output.copy!, input, "image"), { timeoutMs: 20_000 });
        emit({ step: "提示词生成", status: "done", message: "图片描述生成完成（降级）", data: { imagePrompt: output.imagePrompt } });
      } catch (err2) {
        // 兜底：用默认提示词
        output.imagePrompt = buildFallbackImagePrompt(input, output.copy);
        emit({ step: "提示词生成", status: "done", message: "使用默认图片描述", data: { imagePrompt: output.imagePrompt } });
      }
    }
  } else {
    // 文案都没有，直接用默认提示词
    output.imagePrompt = buildFallbackImagePrompt(input, null);
  }

  // === 第三步：提示词 → 海报图片 ===
  emit({ step: "海报生成", status: "running", message: "正在生成招募海报..." });
  try {
    output.imageUrl = await withRetry(() => generatePoster(output.imagePrompt!), { timeoutMs: 60_000 });
    emit({ step: "海报生成", status: "done", message: "海报生成完成", data: { imageUrl: output.imageUrl } });
  } catch (err) {
    emit({ step: "海报生成", status: "error", message: `海报生成失败: ${(err as Error).message}` });
  }

  return output;
}

// === 内部实现 ===

/** 第一步：生成平台文案 */
async function generateCopy(input: RecruitInput, clientName: string): Promise<RecruitCopy> {
  const { client, model } = getClient(clientName);
  const platformStyle = PLATFORM_STYLES[input.platform] ?? `${input.platform}平台风格`;

  const noImage = clientName === "image" ? "\n注意：只输出文字，不要生成图片。" : "";

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `你是家政行业招募文案专家。根据岗位信息直接写出一段招募文案，开头第一行是标题，后面是正文，末尾附上 3-5 个话题标签（用 # 开头）。直接输出文案内容，不要解释。${noImage}`,
      },
      { role: "user", content: buildCopyPrompt(input, platformStyle) },
    ],
    temperature: 0.7,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("模型返回为空");
  return parseCopyFromRaw(raw);
}

/** 第二步：把文案转化成图片提示词 */
async function generateImagePrompt(copy: RecruitCopy, input: RecruitInput, clientName: string): Promise<string> {
  const { client, model } = getClient(clientName);

  const noImage = clientName === "image" ? "\n注意：只输出文字描述，不要生成图片。" : "";

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: `把以下招募信息转成一段英文 image prompt，用于 AI 生成招募海报。

招募信息：
- 岗位：${input.position}
- 地区：${input.region}
- 薪资：${input.salary}
- 联系方式：${input.contact}
- 文案标题：${copy.title}
- 目标平台：${input.platform}

要求：只输出一段英文，描述海报画面（人物、场景、色调、排版），不要中文，不要解释，不要评价。${noImage}`,
      },
    ],
    temperature: 0.7,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("模型返回为空");
  return raw.trim();
}

/** 第三步：用提示词生成海报 */
async function generatePoster(imagePrompt: string): Promise<string> {
  const { client, model } = getClient("image");

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: `Generate this image: ${imagePrompt}` }],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("模型返回为空");

  const match = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
  if (match) return match[1];

  const urlMatch = content.match(/(https?:\/\/[^\s]+\.(png|jpg|jpeg|webp))/i);
  if (urlMatch) return urlMatch[1];

  throw new Error("未提取到图片 URL: " + content.slice(0, 200));
}

/** 兜底图片提示词 */
function buildFallbackImagePrompt(input: RecruitInput, copy: RecruitCopy | null): string {
  return `A professional and warm recruitment poster for a home services company. Position: ${input.position}. Region: ${input.region}. ${input.salary ? `Salary: ${input.salary}.` : ""} The poster features a friendly domestic worker in clean uniform, bright inviting background. Modern design, warm color palette, suitable for ${input.platform} platform.${copy?.title ? ` Title: ${copy.title}` : ""}`;
}

/** 解析自由文本为结构化文案 */
function parseCopyFromRaw(raw: string): RecruitCopy {
  const lines = raw.trim().split("\n");

  let title = "";
  let contentStartIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      title = line.replace(/^#+\s*/, "");
      contentStartIdx = i + 1;
      break;
    }
  }

  const hashtags: string[] = [];
  const contentLines: string[] = [];

  for (let i = contentStartIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    const tags = line.match(/#[^\s#]+/g);
    if (tags && tags.length >= 2) {
      hashtags.push(...tags.map((t) => t.replace(/^#/, "")));
    } else {
      contentLines.push(lines[i]);
    }
  }

  return { title, content: contentLines.join("\n").trim(), hashtags };
}

function buildCopyPrompt(input: RecruitInput, platformStyle: string): string {
  const parts = [
    `为以下岗位生成一段招募文案：`,
    `岗位：${input.position}`,
    `地区：${input.region}`,
    `薪资：${input.salary}`,
    `联系方式：${input.contact}`,
    input.extra ? `其他要求：${input.extra}` : "",
    `\n文案末尾必须包含联系方式：${input.contact}`,
    `\n平台风格：${platformStyle}`,
  ];
  return parts.filter(Boolean).join("\n");
}
