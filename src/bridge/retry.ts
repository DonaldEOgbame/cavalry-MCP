export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 100;
  const maxDelayMs = options.maxDelayMs ?? 2000;

  let attempt = 0;
  while (true) {
    try {
      return await fn(attempt);
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) {
        throw err;
      }
      if (options.shouldRetry && !options.shouldRetry(err)) {
        throw err;
      }
      const delay = Math.min(
        maxDelayMs,
        baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 50,
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
