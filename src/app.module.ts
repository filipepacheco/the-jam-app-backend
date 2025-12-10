import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { JamModule } from './jam/jam.module';
import { MusicoModule } from './musico/musico.module';
import { MusicaModule } from './musica/musica.module';
import { InscricaoModule } from './inscricao/inscricao.module';
import { EscalaModule } from './escala/escala.module';
import { WebsocketModule } from './websocket/websocket.module';
import { AuthModule } from './auth/auth.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    SupabaseModule,
    JamModule,
    MusicoModule,
    MusicaModule,
    InscricaoModule,
    EscalaModule,
    WebsocketModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
