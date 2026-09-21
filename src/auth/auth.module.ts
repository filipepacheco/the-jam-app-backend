import { Module, OnModuleInit } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SupabaseJwtStrategy } from './strategies/supabase-jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { TokenCacheService } from './services/token-cache.service';

@Module({
  imports: [
    PassportModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 30, // 30 requests per minute (GET /auth/me fires on every page navigation)
      },
    ]),
    PrismaModule,
    SupabaseModule,
  ],
  providers: [AuthService, SupabaseJwtStrategy, TokenCacheService],
  controllers: [AuthController],
  exports: [AuthService, TokenCacheService],
})
export class AuthModule implements OnModuleInit {
  constructor(private tokenCache: TokenCacheService) {}

  onModuleInit() {
    // Start cleanup timer on module initialization
    this.tokenCache.startCleanup();
  }
}
