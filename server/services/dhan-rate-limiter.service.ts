/**
 * DhanRateLimiter Service
 * Implements a strict promises Queue Mutex ensuring all DhanHQ API requests
 * are executed sequentially with a mandatory 600ms spacing between calls,
 * eliminating HTTP 429 (Too Many Requests) rate limit errors across concurrent components.
 */
export class DhanRateLimiter {
  private static queue: Promise<any> = Promise.resolve();
  private static MIN_INTERVAL_MS = 600; // 600ms mandatory spacing = max 1.6 req/sec

  /**
   * Execute an async DhanHQ API function with strict single-file mutex queuing and backoff
   */
  public static execute<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T | null> {
    const taskPromise = this.queue.then(async () => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // Enforce strict 600ms spacing between sequential API calls
        await new Promise((r) => setTimeout(r, this.MIN_INTERVAL_MS));

        try {
          const result = await fn();
          if (result) return result;
        } catch (err: any) {
          const is429 =
            err?.status === 429 ||
            err?.statusCode === 429 ||
            (err?.message && (err.message.includes("429") || err.message.toLowerCase().includes("rate limit")));

          if (is429) {
            const backoffMs = Math.pow(2, attempt) * 1500 + Math.floor(Math.random() * 500);
            console.warn(`⏳ [DhanHQ Rate Limiter] HTTP 429 detected! Backing off for ${(backoffMs / 1000).toFixed(1)}s (Attempt ${attempt + 1}/${maxRetries + 1})...`);
            await new Promise((r) => setTimeout(r, backoffMs));
          } else {
            console.warn(`⚠️ [DhanHQ API Request Warning]`, err?.message || err);
            if (attempt === maxRetries) return null;
            await new Promise((r) => setTimeout(r, 600));
          }
        }
      }
      return null;
    });

    // Protect queue chain from uncaught promise rejections
    this.queue = taskPromise.catch(() => {});
    return taskPromise;
  }
}
