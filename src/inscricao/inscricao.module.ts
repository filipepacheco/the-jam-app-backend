import { Module } from '@nestjs/common';
import { InscricaoController } from './inscricao.controller';
import { InscricaoService } from './inscricao.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InscricaoController],
  providers: [InscricaoService],
  exports: [InscricaoService],
})
export class InscricaoModule {}
