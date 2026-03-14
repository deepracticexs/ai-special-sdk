/**
 * 带重试和超时的异步调用
 * 稳定性核心：单次失败自动重试，超时强制中断
 */
export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  opts: { maxRetries?: number; timeoutMs?: number } = {},
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 1;
  const timeoutMs = opts.timeoutMs ?? 60_000;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await fn(controller.signal);
      clearTimeout(timer);
      return result;
    } catch (err) {
      clearTimeout(timer);
      lastError = err as Error;
      if (attempt < maxRetries) {
        // 等 1 秒再重试
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw lastError;
}
