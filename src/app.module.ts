import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { JamModule } from './jam/jam.module';
import { MusicoModule } from './musico/musico.module';
import { MusicaModule } from './musica/musica.module';
import { InscricaoModule } from './inscricao/inscricao.module';
import { EscalaModule } from './escala/escala.module';
import { AuthModule } from './auth/auth.module';
import { SupabaseModule } from './supabase/supabase.module';
import { validate } from './config/env.validation';
import { FeedbackModule } from './feedback/feedback.module';
import { SpotifyModule } from './spotify/spotify.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    PrismaModule,
    AuthModule,
    SupabaseModule,
    JamModule,
    MusicoModule,
    MusicaModule,
    InscricaoModule,
    EscalaModule,
    FeedbackModule,
    SpotifyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
