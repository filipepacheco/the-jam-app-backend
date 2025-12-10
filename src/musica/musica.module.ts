import { Module } from '@nestjs/common';
import { MusicaController } from './musica.controller';
import { MusicaService } from './musica.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MusicaController],
  providers: [MusicaService],
  exports: [MusicaService],
})
export class MusicaModule {}
