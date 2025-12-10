import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedSocket extends Socket {
  data: {
    musicianId?: string;
    musician?: any;
  };
}

// Rate limiting for socket messages
interface MessageRateLimit {
  count: number;
  lastReset: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('WebsocketGateway');
  private messageRateLimits = new Map<string, MessageRateLimit>();

  // Rate limiting config
  private readonly MAX_MESSAGES_PER_SECOND = 10;
  private readonly RATE_LIMIT_WINDOW_MS = 1000;

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  /**
   * Initialize Socket.IO server with authentication middleware
   */
  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Authentication middleware
    server.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace('Bearer ', '');

        if (!token) {
          this.logger.warn(`[WS_AUTH_FAILED] No token provided: ${socket.id}`);
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET,
        });

        if (!decoded || !decoded.sub) {
          return next(new Error('Invalid token payload'));
        }

        // Verify musician exists
        const musician = await this.prisma.musician.findUnique({
          where: { id: decoded.sub },
        });

        if (!musician) {
          this.logger.warn(
            `[WS_AUTH_FAILED] Musician not found: ${decoded.sub}`,
          );
          return next(new Error('Musician not found'));
        }

        // Attach musician data to socket
        socket.data.musicianId = decoded.sub;
        socket.data.musician = musician;

        this.logger.log(
          `[WS_AUTH_SUCCESS] Authenticated: ${musician.name} (${socket.id})`,
        );
        next();
      } catch (error) {
        this.logger.warn(`[WS_AUTH_ERROR] ${error.message}: ${socket.id}`);
        return next(new Error('Invalid or expired token'));
      }
    });
  }

  handleConnection(client: AuthenticatedSocket) {
    this.logger.log(
      `Client connected: ${client.id} (musician: ${client.data.musicianId || 'anonymous'})`,
    );
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(
      `Client disconnected: ${client.id} (musician: ${client.data.musicianId || 'anonymous'})`,
    );
    // Clean up rate limiting data
    this.messageRateLimits.delete(client.id);
  }

  /**
   * Check rate limit for socket messages
   */
  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const limit = this.messageRateLimits.get(clientId);

    if (!limit || now - limit.lastReset > this.RATE_LIMIT_WINDOW_MS) {
      this.messageRateLimits.set(clientId, { count: 1, lastReset: now });
      return true;
    }

    if (limit.count >= this.MAX_MESSAGES_PER_SECOND) {
      return false;
    }

    limit.count++;
    return true;
  }

  @SubscribeMessage('joinJam')
  async handleJoinJam(
    @MessageBody() jamId: string,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    // Rate limiting
    if (!this.checkRateLimit(client.id)) {
      throw new WsException('Rate limit exceeded');
    }

    // Validate jamId
    if (!jamId || typeof jamId !== 'string') {
      throw new WsException('Invalid jam ID');
    }

    // Verify jam exists
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
    });

    if (!jam) {
      throw new WsException('Jam not found');
    }

    client.join(`jam-${jamId}`);
    this.logger.log(
      `Client ${client.id} (${client.data.musician?.name || 'unknown'}) joined jam ${jamId}`,
    );

    // Broadcast to jam room that a musician joined
    this.server.to(`jam-${jamId}`).emit('musicianJoined', {
      musicianId: client.data.musicianId,
      musicianName: client.data.musician?.name,
    });

    return { success: true, message: `Joined jam ${jamId}` };
  }

  @SubscribeMessage('leaveJam')
  handleLeaveJam(
    @MessageBody() jamId: string,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    // Rate limiting
    if (!this.checkRateLimit(client.id)) {
      throw new WsException('Rate limit exceeded');
    }

    if (!jamId || typeof jamId !== 'string') {
      throw new WsException('Invalid jam ID');
    }

    client.leave(`jam-${jamId}`);
    this.logger.log(
      `Client ${client.id} (${client.data.musician?.name || 'unknown'}) left jam ${jamId}`,
    );

    // Broadcast to jam room that a musician left
    this.server.to(`jam-${jamId}`).emit('musicianLeft', {
      musicianId: client.data.musicianId,
      musicianName: client.data.musician?.name,
    });

    return { success: true, message: `Left jam ${jamId}` };
  }

  // Emit events for real-time updates
  emitNewRegistration(jamId: string, registration: any) {
    this.server.to(`jam-${jamId}`).emit('newRegistration', registration);
    this.logger.log(`[WS_EMIT] newRegistration to jam ${jamId}`);
  }

  emitScheduleUpdate(jamId: string, schedule: any) {
    this.server.to(`jam-${jamId}`).emit('scheduleUpdate', schedule);
    this.logger.log(`[WS_EMIT] scheduleUpdate to jam ${jamId}`);
  }

  emitJamStatusUpdate(jamId: string, status: string) {
    this.server.to(`jam-${jamId}`).emit('jamStatusUpdate', { jamId, status });
    this.logger.log(`[WS_EMIT] jamStatusUpdate to jam ${jamId}: ${status}`);
  }

  emitCurrentPerformance(jamId: string, performance: any) {
    this.server.to(`jam-${jamId}`).emit('currentPerformance', performance);
    this.logger.log(`[WS_EMIT] currentPerformance to jam ${jamId}`);
  }

  emitRegistrationApproved(jamId: string, registration: any) {
    this.server.to(`jam-${jamId}`).emit('registrationApproved', registration);
    this.logger.log(`[WS_EMIT] registrationApproved to jam ${jamId}`);
  }
}
