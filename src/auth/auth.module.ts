import { Module, OnModuleInit } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SupabaseJwtStrategy } from './strategies/supabase-jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { TokenCacheService } from './services/token-cache.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 5, // 5 requests per minute
      },
    ]),
    PrismaModule,
    SupabaseModule,
  ],
  providers: [AuthService, JwtStrategy, SupabaseJwtStrategy, TokenCacheService],
  controllers: [AuthController],
  exports: [AuthService, JwtModule, TokenCacheService],
})
export class AuthModule implements OnModuleInit {
  constructor(private tokenCache: TokenCacheService) {}

  onModuleInit() {
    // Start cleanup timer on module initialization
    this.tokenCache.startCleanup();
  }
}
