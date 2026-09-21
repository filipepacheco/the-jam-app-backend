import { Module } from '@nestjs/common';
import { InscricaoController } from './inscricao.controller';
import { InscricaoService } from './inscricao.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JamModule } from '../jam/jam.module';

@Module({
  imports: [PrismaModule, JamModule],
  controllers: [InscricaoController],
  providers: [InscricaoService],
  exports: [InscricaoService],
})
export class InscricaoModule {}
