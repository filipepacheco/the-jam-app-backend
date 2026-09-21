import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenCacheService } from '../services/token-cache.service';

@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(Strategy, 'supabase-jwt') {
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
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);

    // Check cache first
    const cached = this.tokenCache.get(token);
    if (cached) {
      const musician = await this.findOrCreateMusician(cached.supabaseUserId, cached.email);
      return {
        musicianId: musician.id,
        supabaseUserId: cached.supabaseUserId,
        isHost: musician.isHost,
      };
    }

    // Verify token with Supabase service client (the authoritative source)
    const {
      data: { user },
      error,
    } = await this.supabaseService.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException('Invalid or expired Supabase token');
    }

    // Find or create musician
    const musician = await this.findOrCreateMusician(user.id, user.email);

    // Cache only identities which were safely reconciled with the local account.
    this.tokenCache.set(token, {
      supabaseUserId: user.id,
      email: user.email || '',
    });

    return {
      musicianId: musician.id,
      supabaseUserId: user.id,
      isHost: musician.isHost,
    };
  }

  private async findOrCreateMusician(supabaseUserId: string, email?: string) {
    // 1. Find by supabaseUserId
    let musician = await this.prisma.musician.findUnique({
      where: { supabaseUserId },
    });

    if (musician) return musician;

    // An email address is profile data, not a stable credential. Never attach a
    // different provider subject to an existing local musician based on email.
    if (email) {
      musician = await this.prisma.musician.findUnique({
        where: { email },
      });

      if (musician) {
        throw new UnauthorizedException('Unable to authenticate account');
      }
    }

    try {
      return await this.prisma.musician.create({
        data: {
          supabaseUserId,
          email,
          name: email?.split('@')[0] || `User_${supabaseUserId.slice(-4)}`,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // A concurrent first login may have created this subject after our initial lookup.
        musician = await this.prisma.musician.findUnique({ where: { supabaseUserId } });
        if (musician) return musician;
      }

      throw new UnauthorizedException('Unable to authenticate account');
    }
  }
}
