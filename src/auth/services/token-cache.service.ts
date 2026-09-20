import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';

interface CachedUser {
  supabaseUserId: string;
  email: string;
  expiry: number;
}

@Injectable()
export class TokenCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(TokenCacheService.name);
  private cache = new Map<string, CachedUser>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private readonly maxCacheSize = 10000; // Maximum number of cached tokens
  private readonly ttl = 5 * 60 * 1000; // 5 minutes
  private readonly cleanupIntervalMs = 10 * 60 * 1000; // 10 minutes

  get(token: string): CachedUser | null {
    const cached = this.cache.get(token);
    if (!cached) return null;

    if (cached.expiry <= Date.now()) {
      this.cache.delete(token);
      return null;
    }

    // Move to end of map for LRU behavior (Map maintains insertion order)
    this.cache.delete(token);
    this.cache.set(token, cached);

    return cached;
  }

  set(token: string, user: { supabaseUserId: string; email: string }): void {
    // Callers must validate with Supabase first. Decoding only bounds cache lifetime;
    // it is never a substitute for verifying the credential.
    const tokenExpiry = this.readExpiry(token);
    const now = Date.now();
    if (tokenExpiry === null || tokenExpiry <= now) return;

    // Enforce max cache size with LRU eviction - evict down to 90% capacity
    if (this.cache.size >= this.maxCacheSize) {
      const targetSize = Math.floor(this.maxCacheSize * 0.9);
      const iterator = this.cache.keys();
      while (this.cache.size > targetSize) {
        const oldestKey = iterator.next().value;
        if (oldestKey) {
          this.cache.delete(oldestKey);
        } else {
          break;
        }
      }
    }

    this.cache.set(token, {
      ...user,
      expiry: Math.min(now + this.ttl, tokenExpiry),
    });
  }

  private readExpiry(token: string): number | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) {
        return null;
      }
      const payload: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (!payload || typeof payload !== 'object' || !('exp' in payload)) return null;
      const expiry = payload.exp;
      if (typeof expiry !== 'number' || !Number.isFinite(expiry * 1000)) return null;
      return expiry * 1000;
    } catch {
      return null;
    }
  }

  startCleanup(): void {
    if (this.cleanupInterval) {
      return; // Already running
    }

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let expiredCount = 0;
      for (const [token, data] of this.cache.entries()) {
        if (data.expiry <= now) {
          this.cache.delete(token);
          expiredCount++;
        }
      }
      if (expiredCount > 0) {
        this.logger.debug(`Cleaned up ${expiredCount} expired tokens from cache`);
      }
    }, this.cleanupIntervalMs);

    this.logger.log('Token cache cleanup started');
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.log('Token cache cleanup stopped');
    }
    this.cache.clear();
  }

  // For monitoring purposes
}
