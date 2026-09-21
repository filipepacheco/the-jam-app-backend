import { Module } from '@nestjs/common';
import { EscalaController } from './escala.controller';
import { EscalaService } from './escala.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JamModule } from '../jam/jam.module';

@Module({
  imports: [PrismaModule, JamModule],
  controllers: [EscalaController],
  providers: [EscalaService],
  exports: [EscalaService],
})
export class EscalaModule {}
