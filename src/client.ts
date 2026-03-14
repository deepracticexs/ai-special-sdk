import OpenAI from "openai";

export interface ModelConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

const clients = new Map<string, { client: OpenAI; model: string }>();

/**
 * 注册一个模型客户端
 * @param name - 用途名称，如 "image", "text"
 */
export function registerClient(name: string, config: ModelConfig) {
  clients.set(name, {
    client: new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL }),
    model: config.model,
  });
}

/**
 * 从环境变量自动注册客户端
 * SWAN_IMAGE_* → "image"
 * SWAN_TEXT_* → "text"
 */
export function autoRegister() {
  const env = process.env;
  if (env.SWAN_IMAGE_API_KEY && env.SWAN_IMAGE_BASE_URL) {
    registerClient("image", {
      apiKey: env.SWAN_IMAGE_API_KEY,
      baseURL: env.SWAN_IMAGE_BASE_URL,
      model: env.SWAN_IMAGE_MODEL || "gemini-3.1-flash-image-preview",
    });
  }
  if (env.SWAN_TEXT_API_KEY && env.SWAN_TEXT_BASE_URL) {
    registerClient("text", {
      apiKey: env.SWAN_TEXT_API_KEY,
      baseURL: env.SWAN_TEXT_BASE_URL,
      model: env.SWAN_TEXT_MODEL || "claude-sonnet-4-6",
    });
    // 轻量任务用 Haiku（数据结构化等）
    registerClient("fast", {
      apiKey: env.SWAN_TEXT_API_KEY,
      baseURL: env.SWAN_TEXT_BASE_URL,
      model: env.SWAN_FAST_MODEL || "claude-haiku-4-5-20251001",
    });
  }
}

export function getClient(name: string): { client: OpenAI; model: string } {
  const entry = clients.get(name);
  if (!entry) {
    throw new Error(`客户端 "${name}" 未注册，请先调用 registerClient() 或 autoRegister()`);
  }
  return entry;
}
