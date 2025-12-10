import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  aud?: string;
  role?: string;
}

@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(
  Strategy,
  'supabase-jwt',
) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('SUPABASE_JWT_SECRET'),
    });
  }

  async validate(payload: SupabaseJwtPayload) {
    if (!payload.sub) {
      return null;
    }

    // Find musician by Supabase user ID
    let musician = await this.prisma.musician.findUnique({
      where: { supabaseUserId: payload.sub },
    });

    // If not found by Supabase ID, try to find by email and link
    if (!musician && payload.email) {
      musician = await this.prisma.musician.findUnique({
        where: { email: payload.email },
      });

      // Link Supabase ID to existing musician
      if (musician && !musician.supabaseUserId) {
        musician = await this.prisma.musician.update({
          where: { id: musician.id },
          data: { supabaseUserId: payload.sub },
        });
      }
    }

    // Auto-create musician from Supabase user if not exists
    if (!musician) {
      musician = await this.prisma.musician.create({
        data: {
          supabaseUserId: payload.sub,
          email: payload.email,
          name: payload.email?.split('@')[0] || `User_${payload.sub.slice(-4)}`,
        },
      });
    }

    return { musicianId: musician.id, supabaseUserId: payload.sub };
  }
}

