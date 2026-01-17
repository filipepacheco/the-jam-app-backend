import { Injectable } from '@nestjs/common';

interface CachedUser {
  supabaseUserId: string;
  email: string;
  expiry: number;
}

@Injectable()
export class TokenCacheService {
  private cache = new Map<string, CachedUser>();

  get(token: string): CachedUser | null {
    const cached = this.cache.get(token);
    if (!cached) return null;

    if (cached.expiry < Date.now()) {
      this.cache.delete(token);
      return null;
    }

    return cached;
  }

  set(token: string, user: { supabaseUserId: string; email: string }): void {
    this.cache.set(token, {
      ...user,
      expiry: Date.now() + 5 * 60 * 1000, // 5 minutes
    });
  }

  // Cleanup expired entries every 10 minutes
  startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [token, data] of this.cache.entries()) {
        if (data.expiry < now) {
          this.cache.delete(token);
        }
      }
    }, 10 * 60 * 1000);
  }
}
