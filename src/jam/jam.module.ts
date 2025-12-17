import { Module, forwardRef } from '@nestjs/common';
import { JamController } from './jam.controller';
import { JamService } from './jam.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [PrismaModule, forwardRef(() => WebsocketModule)],
  controllers: [JamController],
  providers: [JamService],
  exports: [JamService],
})
export class JamModule {}
