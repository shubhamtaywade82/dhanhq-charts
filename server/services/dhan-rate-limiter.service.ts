/**
 * DhanRateLimiter Service
 * Enforces strict request pacing and exponential backoff retries on HTTP 429 (Too Many Requests).
 */
export class DhanRateLimiter {
  private static lastRequestTime = 0;
  private static MIN_INTERVAL_MS = 350; // 350ms minimum spacing between requests = ~2.8 req/sec

  /**
   * Execute an async DhanHQ API function with rate limit queuing and exponential backoff
   */
  public static async execute<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T | null> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // 1. Enforce minimum request spacing
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;
      if (timeSinceLast < this.MIN_INTERVAL_MS) {
        const waitMs = this.MIN_INTERVAL_MS - timeSinceLast;
        await new Promise((r) => setTimeout(r, waitMs));
      }
      this.lastRequestTime = Date.now();

      try {
        const result = await fn();
        if (result) return result;
      } catch (err: any) {
        const is429 =
          err?.status === 429 ||
          err?.statusCode === 429 ||
          (err?.message && (err.message.includes("429") || err.message.toLowerCase().includes("rate limit")));

        if (is429) {
          const backoffMs = Math.pow(2, attempt) * 1200 + Math.floor(Math.random() * 300); // 1.2s, 2.4s, 4.8s, 9.6s + jitter
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
  }
}
