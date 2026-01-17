import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenCacheService } from '../services/token-cache.service';

@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(
  Strategy,
  'supabase-jwt',
) {
  constructor(
    private prisma: PrismaService,
    @Inject('SUPABASE_SERVICE_CLIENT') private supabaseService: SupabaseClient,
    private tokenCache: TokenCacheService,
  ) {
    super();
  }

  async validate(req: Request) {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.substring(7);

    // Check cache first
    const cached = this.tokenCache.get(token);
    if (cached) {
      const musician = await this.findOrCreateMusician(
        cached.supabaseUserId,
        cached.email,
      );
      return { musicianId: musician.id, supabaseUserId: cached.supabaseUserId };
    }

    // Verify token with Supabase service client (the authoritative source)
    const { data: { user }, error } = await this.supabaseService.auth.getUser(
      token,
    );

    if (error || !user) {
      throw new UnauthorizedException('Invalid or expired Supabase token');
    }

    // Cache validation result
    this.tokenCache.set(token, {
      supabaseUserId: user.id,
      email: user.email || '',
    });

    // Find or create musician
    const musician = await this.findOrCreateMusician(user.id, user.email);

    return {
      musicianId: musician.id,
      supabaseUserId: user.id,
    };
  }

  private async findOrCreateMusician(
    supabaseUserId: string,
    email?: string,
  ) {
    // 1. Find by supabaseUserId
    let musician = await this.prisma.musician.findUnique({
      where: { supabaseUserId },
    });

    if (musician) return musician;

    // 2. Fallback: Find by email and link
    if (email) {
      musician = await this.prisma.musician.findUnique({
        where: { email },
      });

      if (musician && !musician.supabaseUserId) {
        // Auto-link existing musician to Supabase account
        return this.prisma.musician.update({
          where: {id: musician.id},
          data: {supabaseUserId},
        });
      }
    }

    // 3. Auto-create if doesn't exist
    return this.prisma.musician.create({
      data: {
        supabaseUserId,
        email,
        name: email?.split('@')[0] || `User_${supabaseUserId.slice(-4)}`,
      },
    });
  }
}
