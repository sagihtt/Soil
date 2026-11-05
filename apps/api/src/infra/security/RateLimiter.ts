export interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
}

interface WindowBucket {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, WindowBucket>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  public constructor(options: RateLimiterOptions = {}) {
    this.windowMs = options.windowMs ?? 60 * 1000;
    this.maxRequests = options.maxRequests ?? 40;
  }

  public consume(key: string): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const now = Date.now();
    const current = this.buckets.get(key);

    if (!current || now >= current.resetAt) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return {
        allowed: true,
        remaining: Math.max(0, this.maxRequests - 1),
        retryAfterSeconds: 0,
      };
    }

    if (current.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      };
    }

    current.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - current.count),
      retryAfterSeconds: 0,
    };
  }
}
