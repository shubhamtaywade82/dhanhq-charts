/**
 * DhanRateLimiter Service
 * Implements a strict promises Queue Mutex ensuring all DhanHQ API requests
 * are executed sequentially with a mandatory 600ms spacing between calls,
 * eliminating HTTP 429 (Too Many Requests) rate limit errors across concurrent components.
 */
export class DhanRateLimiter {
  private static queue: Promise<any> = Promise.resolve();
  private static MIN_INTERVAL_MS = 600;

  public static execute<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T | null> {
    const taskPromise = this.queue.then(async () => {
      await new Promise((r) => setTimeout(r, this.MIN_INTERVAL_MS));

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await fn();
          if (result !== undefined && result !== null) return result;
          return null;
        } catch (err: any) {
          const is429 =
            err?.status === 429 ||
            err?.statusCode === 429 ||
            (err?.message && (err.message.includes("429") || err.message.toLowerCase().includes("rate limit")));

          if (is429 && attempt < maxRetries) {
            const backoffMs = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 300);
            console.warn(`⏳ [DhanHQ Rate Limiter] HTTP 429 detected! Backing off ${(backoffMs / 1000).toFixed(1)}s...`);
            await new Promise((r) => setTimeout(r, backoffMs));
          } else {
            console.warn(`⚠️ [DhanHQ API Request Notice]`, err?.message || err);
            return null;
          }
        }
      }
      return null;
    });

    this.queue = taskPromise.catch(() => {});
    return taskPromise;
  }
}
