import { Test, TestingModule } from '@nestjs/testing';
import { WebsocketGateway } from './websocket.gateway';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JamService } from '../jam/jam.service';
import { WsException } from '@nestjs/websockets';

describe('WebsocketGateway', () => {
  let gateway: WebsocketGateway;
  let jwtService: JwtService;
  let prismaService: PrismaService;
  let jamService: JamService;
  let mockServer: any;
  let mockSocket: any;

  beforeEach(async () => {
    // Mock Socket.IO server
    mockServer = {
      use: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    // Mock Socket.IO client
    mockSocket = {
      id: 'socket-test-123',
      handshake: {
        auth: { token: 'test-token' },
        headers: {},
      },
      data: {},
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
    };

    // Mock services
    const mockJwtService = {
      verify: jest.fn(),
      sign: jest.fn(),
    };

    const mockPrismaService = {
      jam: {
        findUnique: jest.fn(),
      },
      musician: {
        findUnique: jest.fn(),
      },
    };

    const mockJamService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebsocketGateway,
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JamService, useValue: mockJamService },
      ],
    }).compile();

    gateway = module.get<WebsocketGateway>(WebsocketGateway);
    jwtService = module.get<JwtService>(JwtService);
    prismaService = module.get<PrismaService>(PrismaService);
    jamService = module.get<JamService>(JamService);

    // Set the server on the gateway
    gateway.server = mockServer;
  });

  describe('afterInit', () => {
    it('should initialize gateway and set up authentication middleware', () => {
      gateway.afterInit(mockServer);

      expect(mockServer.use).toHaveBeenCalled();
    });

    it('should allow connection without token', async () => {
      gateway.afterInit(mockServer);

      expect(mockServer.use).toHaveBeenCalled();
    });

    it('should verify token if provided', async () => {
      const decodedToken = { sub: 'musician-123', role: 'musician' };
      jest.spyOn(jwtService, 'verify').mockReturnValue(decodedToken as any);
      jest.spyOn(prismaService.musician, 'findUnique').mockResolvedValue({
        id: 'musician-123',
        name: 'Test Musician',
      } as any);

      const nextMock = jest.fn();

      gateway.afterInit(mockServer);
      const middlewareFn = mockServer.use.mock.calls[0][0];
      await middlewareFn(mockSocket, nextMock);

      expect(nextMock).toHaveBeenCalled();
      expect(mockSocket.data.musicianId).toBe('musician-123');
    });

    it('should handle invalid token gracefully', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const nextMock = jest.fn();

      gateway.afterInit(mockServer);
      const middlewareFn = mockServer.use.mock.calls[0][0];
      await middlewareFn(mockSocket, nextMock);

      expect(nextMock).toHaveBeenCalled();
    });
  });

  describe('handleConnection', () => {
    it('should log client connection', () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      gateway.handleConnection(mockSocket);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Client connected'));
    });

    it('should handle anonymous connection', () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');
      const anonSocket = { ...mockSocket, data: {} };

      gateway.handleConnection(anonSocket);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('anonymous'),
      );
    });
  });

  describe('handleDisconnect', () => {
    it('should log client disconnection', () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      gateway.handleDisconnect(mockSocket);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Client disconnected'),
      );
    });

    it('should clean up rate limiting data on disconnect', () => {
      // Simulate a message to populate rate limit map
      gateway['messageRateLimits'].set('socket-test-123', {
        count: 5,
        lastReset: Date.now(),
      });

      gateway.handleDisconnect(mockSocket);

      expect(gateway['messageRateLimits'].has('socket-test-123')).toBe(false);
    });
  });

  describe('handleJoinJam', () => {
    beforeEach(() => {
      jest.spyOn(prismaService.jam, 'findUnique').mockResolvedValue({
        id: 'jam-123',
        hostMusicianId: 'host-123',
      } as any);

      jest.spyOn(jamService, 'findOne').mockResolvedValue({
        id: 'jam-123',
        name: 'Test Jam',
      } as any);
    });

    it('should join jam with string jamId', async () => {
      mockSocket.data.musicianId = 'musician-123';
      mockSocket.data.musician = { id: 'musician-123', name: 'Test' };

      const result = await gateway.handleJoinJam('jam-123', mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('jam-jam-123');
      expect(mockSocket.join).toHaveBeenCalledWith('jam-jam-123-musician');
      expect(result.success).toBe(true);
    });

    it('should set host role when musician is jam host', async () => {
      mockSocket.data.musicianId = 'host-123';
      mockSocket.data.musician = { id: 'host-123', name: 'Host' };

      await gateway.handleJoinJam('jam-123', mockSocket);

      expect(mockSocket.data.role).toBe('host');
      expect(mockSocket.join).toHaveBeenCalledWith('jam-jam-123-host');
    });

    it('should set musician role when not host', async () => {
      mockSocket.data.musicianId = 'musician-456';
      mockSocket.data.musician = { id: 'musician-456', name: 'Musician' };

      await gateway.handleJoinJam('jam-123', mockSocket);

      expect(mockSocket.data.role).toBe('musician');
    });

    it('should set public role when not authenticated', async () => {
      mockSocket.data = {};

      await gateway.handleJoinJam('jam-123', mockSocket);

      expect(mockSocket.data.role).toBe('public');
      expect(mockSocket.join).toHaveBeenCalledWith('jam-jam-123-public');
    });

    it('should throw error for invalid jamId', async () => {
      mockSocket.data.musicianId = 'musician-123';

      await expect(gateway.handleJoinJam({}, mockSocket)).rejects.toThrow(
        WsException,
      );
    });

    it('should throw error when jam not found', async () => {
      mockSocket.data.musicianId = 'musician-123';
      jest.spyOn(prismaService.jam, 'findUnique').mockResolvedValue(null);

      await expect(gateway.handleJoinJam('invalid-jam', mockSocket)).rejects.toThrow(
        WsException,
      );
    });

    it('should authenticate with token if provided', async () => {
      const decodedToken = { sub: 'musician-123' };
      jest.spyOn(jwtService, 'verify').mockReturnValue(decodedToken as any);
      jest.spyOn(prismaService.musician, 'findUnique').mockResolvedValue({
        id: 'musician-123',
        name: 'Token Musician',
      } as any);

      const result = await gateway.handleJoinJam(
        { jamId: 'jam-123', token: 'test-token' },
        mockSocket,
      );

      expect(mockSocket.data.musicianId).toBe('musician-123');
      expect(result.success).toBe(true);
    });

    it('should emit initial state on join', async () => {
      mockSocket.data.musicianId = 'musician-123';
      mockSocket.data.musician = { id: 'musician-123', name: 'Test' };

      await gateway.handleJoinJam('jam-123', mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'live:state-sync',
        expect.objectContaining({ jamId: 'jam-123' }),
      );
    });

    it('should notify host when musician joins', async () => {
      mockSocket.data.musicianId = 'musician-456';
      mockSocket.data.musician = { id: 'musician-456', name: 'New Musician' };

      await gateway.handleJoinJam('jam-123', mockSocket);

      expect(mockServer.to).toHaveBeenCalledWith('jam-jam-123-host');
    });

    it('should respect rate limiting', async () => {
      mockSocket.data.musicianId = 'musician-123';

      // Simulate rate limit exceeded
      gateway['messageRateLimits'].set('socket-test-123', {
        count: 10,
        lastReset: Date.now(),
      });

      await expect(gateway.handleJoinJam('jam-123', mockSocket)).rejects.toThrow(
        WsException,
      );
    });
  });

  describe('handleLeaveJam', () => {
    it('should leave jam room', () => {
      mockSocket.data.jamId = 'jam-123';
      mockSocket.data.role = 'musician';

      const result = gateway.handleLeaveJam('jam-123', mockSocket);

      expect(mockSocket.leave).toHaveBeenCalledWith('jam-jam-123');
      expect(mockSocket.leave).toHaveBeenCalledWith('jam-jam-123-musician');
      expect(result.success).toBe(true);
    });

    it('should clear jam data after leaving', () => {
      mockSocket.data.jamId = 'jam-123';
      mockSocket.data.role = 'musician';

      gateway.handleLeaveJam('jam-123', mockSocket);

      expect(mockSocket.data.jamId).toBeUndefined();
      expect(mockSocket.data.role).toBeUndefined();
    });

    it('should notify host when musician leaves', () => {
      mockSocket.data.jamId = 'jam-123';
      mockSocket.data.role = 'musician';
      mockSocket.data.musicianId = 'musician-456';
      mockSocket.data.musician = { name: 'Musician' };

      gateway.handleLeaveJam('jam-123', mockSocket);

      expect(mockServer.to).toHaveBeenCalledWith('jam-jam-123-host');
    });

    it('should throw error for invalid jamId', () => {
      mockSocket.data.role = 'musician';

      expect(() => gateway.handleLeaveJam('', mockSocket)).toThrow(WsException);
    });

    it('should respect rate limiting', () => {
      mockSocket.data.role = 'musician';

      // Simulate rate limit exceeded
      gateway['messageRateLimits'].set('socket-test-123', {
        count: 10,
        lastReset: Date.now(),
      });

      expect(() => gateway.handleLeaveJam('jam-123', mockSocket)).toThrow(
        WsException,
      );
    });
  });

  describe('handleHostRequestState', () => {
    beforeEach(() => {
      jest.spyOn(prismaService.jam, 'findUnique').mockResolvedValue({
        id: 'jam-123',
      } as any);

      jest.spyOn(jamService, 'findOne').mockResolvedValue({
        id: 'jam-123',
        name: 'Test Jam',
      } as any);
    });

    it('should return jam state for host', async () => {
      const result = await gateway.handleHostRequestState('jam-123', mockSocket);

      expect(result.success).toBe(true);
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'live:state-sync',
        expect.objectContaining({ jamId: 'jam-123' }),
      );
    });

    it('should handle object data with jamId', async () => {
      const result = await gateway.handleHostRequestState(
        { jamId: 'jam-123' },
        mockSocket,
      );

      expect(result.success).toBe(true);
    });

    it('should throw error for invalid jamId', async () => {
      await expect(
        gateway.handleHostRequestState({}, mockSocket),
      ).rejects.toThrow(WsException);
    });

    it('should throw error when jam not found', async () => {
      jest.spyOn(prismaService.jam, 'findUnique').mockResolvedValue(null);

      await expect(
        gateway.handleHostRequestState('invalid-jam', mockSocket),
      ).rejects.toThrow(WsException);
    });

    it('should respect rate limiting', async () => {
      gateway['messageRateLimits'].set('socket-test-123', {
        count: 10,
        lastReset: Date.now(),
      });

      await expect(
        gateway.handleHostRequestState('jam-123', mockSocket),
      ).rejects.toThrow(WsException);
    });
  });

  describe('handleMusicianRequestState', () => {
    beforeEach(() => {
      jest.spyOn(prismaService.jam, 'findUnique').mockResolvedValue({
        id: 'jam-123',
      } as any);

      jest.spyOn(jamService, 'findOne').mockResolvedValue({
        id: 'jam-123',
        name: 'Test Jam',
      } as any);
    });

    it('should return jam state for musician', async () => {
      mockSocket.data.musicianId = 'musician-123';
      mockSocket.data.musician = { id: 'musician-123', name: 'Test Musician' };

      const result = await gateway.handleMusicianRequestState('jam-123', mockSocket);

      expect(result.success).toBe(true);
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'live:state-sync',
        expect.objectContaining({ jamId: 'jam-123' }),
      );
    });

    it('should handle object data with jamId', async () => {
      mockSocket.data.musicianId = 'musician-123';
      mockSocket.data.musician = { id: 'musician-123', name: 'Test Musician' };

      const result = await gateway.handleMusicianRequestState(
        { jamId: 'jam-123' },
        mockSocket,
      );

      expect(result.success).toBe(true);
    });

    it('should throw error for invalid jamId', async () => {
      mockSocket.data.musicianId = 'musician-123';

      await expect(
        gateway.handleMusicianRequestState({}, mockSocket),
      ).rejects.toThrow(WsException);
    });

    it('should throw error when musician not authenticated', async () => {
      mockSocket.data = {};

      await expect(
        gateway.handleMusicianRequestState('jam-123', mockSocket),
      ).rejects.toThrow(WsException);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow messages within rate limit', () => {
      const clientId = 'test-client';

      for (let i = 0; i < 10; i++) {
        const result = gateway['checkRateLimit'](clientId);
        expect(result).toBe(true);
      }
    });

    it('should block messages exceeding rate limit', () => {
      const clientId = 'test-client';

      for (let i = 0; i < 10; i++) {
        gateway['checkRateLimit'](clientId);
      }

      const blockedResult = gateway['checkRateLimit'](clientId);
      expect(blockedResult).toBe(false);
    });

    it('should reset rate limit after window expires', () => {
      const clientId = 'test-client';

      // Fill up rate limit
      for (let i = 0; i < 10; i++) {
        gateway['checkRateLimit'](clientId);
      }

      // Should be blocked
      expect(gateway['checkRateLimit'](clientId)).toBe(false);

      // Simulate time passing
      const limit = gateway['messageRateLimits'].get(clientId);
      limit.lastReset = Date.now() - 2000; // 2 seconds ago

      // Should be allowed again
      expect(gateway['checkRateLimit'](clientId)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully in handleHostRequestState', async () => {
      jest
        .spyOn(jamService, 'findOne')
        .mockRejectedValue(new Error('Service error'));

      jest.spyOn(prismaService.jam, 'findUnique').mockResolvedValue({
        id: 'jam-123',
      } as any);

      await expect(
        gateway.handleHostRequestState('jam-123', mockSocket),
      ).rejects.toThrow(WsException);
    });

    it('should log errors appropriately', async () => {
      const errorSpy = jest.spyOn(gateway['logger'], 'error');
      jest
        .spyOn(jamService, 'findOne')
        .mockRejectedValue(new Error('Service error'));
      jest.spyOn(prismaService.jam, 'findUnique').mockResolvedValue({
        id: 'jam-123',
      } as any);

      try {
        await gateway.handleHostRequestState('jam-123', mockSocket);
      } catch (e) {
        // Ignore
      }

      expect(errorSpy).toHaveBeenCalled();
    });
  });
});

