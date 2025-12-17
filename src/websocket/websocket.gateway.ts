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
import {forwardRef, Inject, Logger} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JamService } from '../jam/jam.service';

interface AuthenticatedSocket extends Socket {
  data: {
    musicianId?: string;
    musician?: any;
    jamId?: string;
    role?: 'host' | 'musician' | 'public';
  };
}

// Rate limiting for socket messages
interface MessageRateLimit {
  count: number;
  lastReset: number;
}

@WebSocketGateway({
  cors: {
    origin: function (origin, callback) {
      const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

      // Development: allow all
      if (isDevelopment) {
        callback(null, true);
        return;
      }

      // Production: explicit allowlist
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174',
        'https://karaoke-jam-frontend.vercel.app',
        'https://lets-jam-web.vercel.app',
        'https://jamapp.com.br',
        'https://www.jamapp.com.br',
      ];

      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        console.warn(`[WS_CORS] Origin rejected: ${origin}`);
        callback(new Error('CORS not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST'],
  },
  // Transports configuration for Vercel compatibility
  transports: ['websocket', 'polling'],
  // Connection settings
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
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
    @Inject(forwardRef(() => JamService))  // ← Use forwardRef in constructor
    private readonly jamService: JamService,
  ) {}

  /**
   * Initialize Socket.IO server with optional authentication middleware
   * Authentication is optional on connection, required on jam-specific operations
   */
  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Authentication middleware - optional, will be validated per message
    server.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace('Bearer ', '');

        // If no token provided, allow connection (will authenticate on joinJam)
        if (!token) {
          this.logger.debug(`[WS_CONN_UNAUTHENTICATED] No token provided: ${socket.id}`);
          return next();
        }

        // Verify JWT token if provided
        let decoded;
        try {
          decoded = this.jwtService.verify(token);
        } catch (verifyError) {
          this.logger.debug(`[WS_TOKEN_VERIFY_FAILED] ${verifyError.message}: ${socket.id}`);
          // Allow connection even if token invalid, will fail on jam operations
          return next();
        }

        if (!decoded || !decoded.sub) {
          return next();
        }

        // Verify musician exists
        const musician = await this.prisma.musician.findUnique({
          where: { id: decoded.sub },
        });

        if (!musician) {
          this.logger.debug(
            `[WS_MUSICIAN_NOT_FOUND] Musician not found: ${decoded.sub}`,
          );
          return next();
        }

        // Attach musician data to socket
        socket.data.musicianId = decoded.sub;
        socket.data.musician = musician;

        this.logger.log(
          `[WS_AUTH_SUCCESS] Authenticated: ${musician.name} (${socket.id})`,
        );
        next();
      } catch (error) {
        this.logger.debug(`[WS_AUTH_ERROR] ${error.message}: ${socket.id}`);
        // Allow connection, authentication will be checked per message
        return next();
      }
    });
  }

  /**
   * Validate that socket is authenticated
   * Used by jam-related operations
   */
  private validateAuthenticated(socket: AuthenticatedSocket): boolean {
    return !!(socket.data.musicianId && socket.data.musician);
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
    @MessageBody() data: any,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    // Rate limiting
    if (!this.checkRateLimit(client.id)) {
      throw new WsException('Rate limit exceeded');
    }

    // Handle both string (jamId) and object (jamId + token) payloads
    const jamId = typeof data === 'string' ? data : data?.jamId;
    const token = typeof data === 'object' ? data?.token : null;

    // Validate jamId
    if (!jamId || typeof jamId !== 'string') {
      throw new WsException('Invalid jam ID');
    }

    // If token provided and socket not yet authenticated, authenticate now
    if (token && !this.validateAuthenticated(client)) {
      try {
        const decoded = this.jwtService.verify(token);
        if (decoded && decoded.sub) {
          const musician = await this.prisma.musician.findUnique({
            where: { id: decoded.sub },
          });
          if (musician) {
            client.data.musicianId = decoded.sub;
            client.data.musician = musician;
            this.logger.log(
              `[WS_AUTH_SUCCESS] Authenticated on joinJam: ${musician.name} (${client.id})`,
            );
          }
        }
      } catch (error) {
        this.logger.warn(`[WS_AUTH_FAILED_JOINjam] Token invalid: ${client.id}`);
        throw new WsException('Authentication failed. Invalid or expired token.');
      }
    }

    // Verify jam exists
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
    });

    if (!jam) {
      throw new WsException('Jam not found');
    }

    // Determine role: host, musician, or public
    let role: 'host' | 'musician' | 'public' = 'public';

    if (client.data.musicianId) {
      // Musician is authenticated - check if they're the host
      if (jam.hostMusicianId === client.data.musicianId) {
        role = 'host';
      } else {
        role = 'musician';
      }
    }

    // Store jam and role in socket data for later use
    client.data.jamId = jamId;
    client.data.role = role;

    // Join main jam room
    client.join(`jam-${jamId}`);

    // Join role-specific room
    client.join(`jam-${jamId}-${role}`);

    this.logger.log(
      `Client ${client.id} (${role} | ${client.data.musician?.name || 'anonymous'}) joined jam ${jamId}`,
    );

    // Send current state immediately on connection
    const jamState = await this.jamService.findOne(jamId);
    client.emit('live:state-sync', {
      jamId,
      state: jamState,
    });

    this.logger.debug(
      `[WS_STATE_SYNC] Sent initial state to ${client.id} on join`,
    );

    // Notify host if a musician connects (but not if host is connecting)
    if (role === 'musician') {
      this.server.to(`jam-${jamId}-host`).emit('musician:connected', {
        jamId,
        musician: {
          id: client.data.musicianId,
          name: client.data.musician?.name,
          instrument: client.data.musician?.instrument,
        },
        timestamp: new Date(),
      });

      this.logger.log(
        `[WS_NOTIFY] Musician ${client.data.musician?.name} connected to jam ${jamId}`,
      );
    }

    // Broadcast to jam room that someone joined
    this.server.to(`jam-${jamId}`).emit('musicianJoined', {
      jamId,
      musicianId: client.data.musicianId,
      musicianName: client.data.musician?.name,
      role,
      timestamp: new Date(),
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

    const role = client.data.role || 'public';

    // Leave main jam room
    client.leave(`jam-${jamId}`);

    // Leave role-specific room
    client.leave(`jam-${jamId}-${role}`);

    this.logger.log(
      `Client ${client.id} (${role} | ${client.data.musician?.name || 'unknown'}) left jam ${jamId}`,
    );

    // Notify host if a musician disconnects
    if (role === 'musician') {
      this.server.to(`jam-${jamId}-host`).emit('musician:disconnected', {
        jamId,
        musicianId: client.data.musicianId,
        musicianName: client.data.musician?.name,
        disconnectedAt: new Date(),
      });

      this.logger.log(
        `[WS_NOTIFY] Musician ${client.data.musician?.name} disconnected from jam ${jamId}`,
      );
    }

    // Broadcast to jam room that someone left
    this.server.to(`jam-${jamId}`).emit('musicianLeft', {
      jamId,
      musicianId: client.data.musicianId,
      musicianName: client.data.musician?.name,
      role,
      timestamp: new Date(),
    });

    // Clear jam-specific data
    client.data.jamId = undefined;
    client.data.role = undefined;

    return { success: true, message: `Left jam ${jamId}` };
  }

  /**
   * HOST: Request full jam state
   */
  @SubscribeMessage('host:request-state')
  async handleHostRequestState(
    @MessageBody() data: any,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!this.checkRateLimit(client.id)) {
      throw new WsException('Rate limit exceeded');
    }

    try {
      const jamId = typeof data === 'string' ? data : data?.jamId;

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

      // Fetch full state
      const jamState = await this.jamService.findOne(jamId);

      this.logger.debug(
        `[WS_HANDLER] host:request-state from ${client.id} for jam ${jamId}`,
      );

      // Send state back to requesting client
      client.emit('live:state-sync', {
        jamId,
        state: jamState,
      });

      return { success: true, message: 'State synced' };
    } catch (error) {
      this.logger.error(
        `[WS_ERROR] host:request-state failed: ${error.message}`,
        error.stack,
      );
      throw new WsException(error.message || 'Failed to request state');
    }
  }

  /**
   * MUSICIAN: Request jam state (musician view)
   */
  @SubscribeMessage('musician:request-state')
  async handleMusicianRequestState(
    @MessageBody() data: any,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!this.checkRateLimit(client.id)) {
      throw new WsException('Rate limit exceeded');
    }

    try {
      const jamId = typeof data === 'string' ? data : data?.jamId;

      if (!jamId || typeof jamId !== 'string') {
        throw new WsException('Invalid jam ID');
      }

      // Verify musician is authenticated
      // if (!client.data.musicianId) {
      //   throw new WsException('Musician not authenticated');
      // }

      // Verify jam exists
      const jam = await this.prisma.jam.findUnique({
        where: { id: jamId },
      });

      if (!jam) {
        throw new WsException('Jam not found');
      }

      // Fetch full state
      const jamState = await this.jamService.findOne(jamId);

      this.logger.debug(
        `[WS_HANDLER] musician:request-state from ${client.id} (musician: ${client.data.musicianId}) for jam ${jamId}`,
      );

      // Send state back to requesting client
      client.emit('live:state-sync', {
        jamId,
        state: jamState,
      });

      return { success: true, message: 'State synced' };
    } catch (error) {
      this.logger.error(
        `[WS_ERROR] musician:request-state failed: ${error.message}`,
        error.stack,
      );
      throw new WsException(error.message || 'Failed to request state');
    }
  }

  /**
   * PUBLIC: Request jam state (public view)
   */
  @SubscribeMessage('public:request-state')
  async handlePublicRequestState(
    @MessageBody() data: any,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!this.checkRateLimit(client.id)) {
      throw new WsException('Rate limit exceeded');
    }

    try {
      const jamId = typeof data === 'string' ? data : data?.jamId;

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

      // Fetch full state
      const jamState = await this.jamService.findOne(jamId);

      this.logger.debug(
        `[WS_HANDLER] public:request-state from ${client.id} for jam ${jamId}`,
      );

      // Send state back to requesting client
      client.emit('live:state-sync', {
        jamId,
        state: jamState,
      });

      return { success: true, message: 'State synced' };
    } catch (error) {
      this.logger.error(
        `[WS_ERROR] public:request-state failed: ${error.message}`,
        error.stack,
      );
      throw new WsException(error.message || 'Failed to request state');
    }
  }

  /**
   * MUSICIAN: Signal ready for performance
   */
  @SubscribeMessage('musician:ready')
  async handleMusicianReady(
    @MessageBody() data: any,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!this.checkRateLimit(client.id)) {
      throw new WsException('Rate limit exceeded');
    }

    try {
      // Verify musician is authenticated
      if (!client.data.musicianId) {
        throw new WsException('Musician not authenticated');
      }

      const jamId = typeof data === 'object' ? data?.jamId : null;
      const scheduleId = typeof data === 'object' ? data?.scheduleId : null;

      if (!jamId || !scheduleId) {
        throw new WsException('jamId and scheduleId are required');
      }

      // Verify jam exists
      const jam = await this.prisma.jam.findUnique({
        where: { id: jamId },
      });

      if (!jam) {
        throw new WsException('Jam not found');
      }

      // Verify schedule belongs to jam
      const schedule = await this.prisma.schedule.findUnique({
        where: { id: scheduleId },
        include: { music: true },
      });

      if (!schedule || schedule.jamId !== jamId) {
        throw new WsException('Schedule not found in this jam');
      }

      this.logger.log(
        `[WS_HANDLER] musician:ready from ${client.data.musician?.name} (${client.data.musicianId}) for schedule ${scheduleId}`,
      );

      // Broadcast musician ready signal to host room
      this.server.to(`jam-${jamId}-host`).emit('musician:ready', {
        jamId,
        scheduleId,
        musicianId: client.data.musicianId,
        musicianName: client.data.musician?.name,
        timestamp: new Date(),
      });

      return { success: true, message: 'Ready signal sent' };
    } catch (error) {
      this.logger.error(
        `[WS_ERROR] musician:ready failed: ${error.message}`,
        error.stack,
      );
      throw new WsException(error.message || 'Failed to signal ready');
    }
  }

  // ============================================================
  // Standardized Emit Helper Methods
  // ============================================================

  /**
   * Broadcast to all users in a jam room
   */
  emitToJam(jamId: string, event: string, data: any) {
    this.server.to(`jam-${jamId}`).emit(event, data);
    this.logger.log(
      `[WS_EMIT] ${event} to jam-${jamId} (size: ${JSON.stringify(data).length})`,
    );
  }

  /**
   * Send only to host room
   */
  emitToHost(jamId: string, event: string, data: any) {
    this.server.to(`jam-${jamId}-host`).emit(event, data);
    this.logger.log(
      `[WS_EMIT] ${event} to jam-${jamId}-host (size: ${JSON.stringify(data).length})`,
    );
  }

  /**
   * Send only to musicians room
   */
  emitToMusicians(jamId: string, event: string, data: any) {
    this.server.to(`jam-${jamId}-musicians`).emit(event, data);
    this.logger.log(
      `[WS_EMIT] ${event} to jam-${jamId}-musicians (size: ${JSON.stringify(data).length})`,
    );
  }

  /**
   * Send only to public room
   */
  emitToPublic(jamId: string, event: string, data: any) {
    this.server.to(`jam-${jamId}-public`).emit(event, data);
    this.logger.log(
      `[WS_EMIT] ${event} to jam-${jamId}-public (size: ${JSON.stringify(data).length})`,
    );
  }

  /**
   * Send to specific client by socket ID
   */
  emitToClient(clientId: string, event: string, data: any) {
    this.server.to(clientId).emit(event, data);
    this.logger.debug(
      `[WS_EMIT] ${event} to client ${clientId} (size: ${JSON.stringify(data).length})`,
    );
  }

  // ============================================================
  // Legacy Emit Methods (kept for backward compatibility)
  // ============================================================

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

  broadcastJamUpdate(jamId: string, jam: any) {
    this.server.to(`jam-${jamId}`).emit('jam:action-executed', jam);
    this.logger.log(`[WS_EMIT] jam:action-executed to jam ${jamId}`);
  }
}

