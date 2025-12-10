import { Module } from '@nestjs/common';
import { EscalaController } from './escala.controller';
import { EscalaService } from './escala.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EscalaController],
  providers: [EscalaService],
  exports: [EscalaService],
})
export class EscalaModule {}
