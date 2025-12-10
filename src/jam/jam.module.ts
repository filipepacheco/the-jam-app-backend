import { Module } from '@nestjs/common';
import { JamController } from './jam.controller';
import { JamService } from './jam.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [JamController],
  providers: [JamService],
  exports: [JamService],
})
export class JamModule {}
