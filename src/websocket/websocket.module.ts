import { Module, forwardRef } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { JamModule } from '../jam/jam.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    forwardRef(() => JamModule),  // ← Use forwardRef here
  ],
  providers: [WebsocketGateway],
  exports: [WebsocketGateway],
})
export class WebsocketModule {}
