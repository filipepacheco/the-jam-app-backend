import { Module } from '@nestjs/common';
import { JamController } from './jam.controller';
import { JamService } from './jam.service';
import { JamPlaybackService } from './jam-playback.service';
import { JamLiveStateService } from './jam-live-state.service';
import { JamManagementService } from './jam-management.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [JamController],
  providers: [JamService, JamPlaybackService, JamLiveStateService, JamManagementService],
  exports: [JamService, JamPlaybackService, JamLiveStateService, JamManagementService],
})
export class JamModule {}
