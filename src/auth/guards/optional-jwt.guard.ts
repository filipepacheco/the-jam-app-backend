import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenCacheService } from '../services/token-cache.service';

@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(
    @Inject('SUPABASE_SERVICE_CLIENT') private supabaseService: SupabaseClient,
    private prisma: PrismaService,
    private tokenCache: TokenCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      request.user = null;
      return true;
    }

    try {
      const token = authHeader.substring(7);

      // Check cache first
      const cached = this.tokenCache.get(token);
      if (cached) {
        const musician = await this.prisma.musician.findUnique({
          where: { supabaseUserId: cached.supabaseUserId },
        });
        request.user = musician
          ? { musicianId: musician.id, supabaseUserId: cached.supabaseUserId }
          : null;
        return true;
      }

      // Verify with Supabase
      const {
        data: { user },
        error,
      } = await this.supabaseService.auth.getUser(token);

      if (error || !user) {
        request.user = null;
        return true;
      }

      // Cache the result
      this.tokenCache.set(token, {
        supabaseUserId: user.id,
        email: user.email || '',
      });

      const musician = await this.prisma.musician.findUnique({
        where: { supabaseUserId: user.id },
      });

      request.user = musician ? { musicianId: musician.id, supabaseUserId: user.id } : null;
      return true;
    } catch {
      request.user = null;
      return true;
    }
  }
}
