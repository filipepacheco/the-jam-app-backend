import { Module } from '@nestjs/common';
import { SpotifyController } from './spotify.controller';
import { SpotifyService } from './spotify.service';
import { SpotifyApiClient } from './spotify-api.client';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SpotifyController],
  providers: [SpotifyService, SpotifyApiClient],
})
export class SpotifyModule {}
