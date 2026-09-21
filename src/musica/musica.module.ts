import { Module } from '@nestjs/common';
import { MusicaController } from './musica.controller';
import { MusicaService } from './musica.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JamModule } from '../jam/jam.module';

@Module({
  imports: [PrismaModule, JamModule],
  controllers: [MusicaController],
  providers: [MusicaService],
  exports: [MusicaService],
})
export class MusicaModule {}
