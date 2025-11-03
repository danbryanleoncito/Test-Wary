/**
 * Redis client for caching and rate limiting
 * Note: This is a simple in-memory implementation for development
 * In production, use actual Redis with ioredis or node-redis
 */

class SimpleCache {
  private cache: Map<string, { value: any; expiry: number }> = new Map();

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    const expiry = expirySeconds
      ? Date.now() + expirySeconds * 1000
      : Date.now() + 3600 * 1000; // 1 hour default

    this.cache.set(key, { value, expiry });
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.set(key, value, seconds);
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const newValue = (parseInt(current || '0', 10) + 1).toString();
    await this.set(key, newValue);
    return parseInt(newValue, 10);
  }

  async expire(key: string, seconds: number): Promise<void> {
    const item = this.cache.get(key);
    if (item) {
      item.expiry = Date.now() + seconds * 1000;
    }
  }
}

export const redis = new SimpleCache();

/**
 * Rate limiter using Redis
 */
export class RateLimiter {
  private limits = {
    anonymous: 100, // requests per hour
    authenticated: 1000,
    api_key: 10000,
  };

  async checkLimit(
    identifier: string,
    type: 'anonymous' | 'authenticated' | 'api_key' = 'anonymous'
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const key = `rate_limit:${type}:${identifier}`;
    const limit = this.limits[type];
    const window = 3600; // 1 hour in seconds

    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, window);
    }

    const remaining = Math.max(0, limit - current);
    const resetAt = new Date(Date.now() + window * 1000);

    return {
      allowed: current <= limit,
      remaining,
      resetAt,
    };
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Cache helper functions
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 3600
): Promise<T> {
  const cached = await redis.get(key);

  if (cached) {
    return JSON.parse(cached);
  }

  const data = await fetcher();
  await redis.setex(key, ttl, JSON.stringify(data));

  return data;
}

export async function invalidateCache(pattern: string): Promise<void> {
  // In a real Redis implementation, you would use SCAN to find and delete keys
  // For this simple implementation, we'll just delete the exact key
  await redis.del(pattern);
}
