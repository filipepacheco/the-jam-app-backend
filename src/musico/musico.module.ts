import { Module } from '@nestjs/common';
import { MusicoController } from './musico.controller';
import { MusicoService } from './musico.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MusicoController],
  providers: [MusicoService],
  exports: [MusicoService],
})
export class MusicoModule {}
