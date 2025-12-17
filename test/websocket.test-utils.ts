import { Server, Socket } from 'socket.io';

/**
 * Test utilities for WebSocket testing
 */

export interface MockSocketOptions {
  id?: string;
  token?: string;
  authenticated?: boolean;
  musicianId?: string;
  jamId?: string;
  role?: 'host' | 'musician' | 'public';
}

/**
 * Create a mock Socket.IO socket for testing
 */
export function createMockSocket(options: MockSocketOptions = {}) {
  const {
    id = 'socket-test-' + Math.random().toString(36).substr(2, 9),
    token,
    authenticated = false,
    musicianId,
    jamId,
    role,
  } = options;

  const socket = {
    id,
    handshake: {
      auth: token ? { token } : {},
      headers: {},
    },
    data: {
      musicianId,
      musician: authenticated ? { id: musicianId, name: 'Test Musician' } : undefined,
      jamId,
      role,
    },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    disconnect: jest.fn(),
  };

  return socket as any;
}

/**
 * Create a mock Socket.IO server for testing
 */
export function createMockServer() {
  return {
    use: jest.fn(),
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    in: jest.fn().mockReturnThis(),
    of: jest.fn().mockReturnThis(),
  } as any as Server;
}

/**
 * Create a mock JWT service
 */
export function createMockJwtService() {
  return {
    verify: jest.fn(),
    sign: jest.fn(),
    decode: jest.fn(),
  };
}

/**
 * Create a mock Prisma service
 */
export function createMockPrismaService() {
  return {
    jam: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    musician: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    musica: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    inscricao: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    escala: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

/**
 * Create a mock Jam service
 */
export function createMockJamService() {
  return {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findByMusician: jest.fn(),
  };
}

/**
 * Helper to create a valid JWT token payload
 */
export function createValidTokenPayload(overrides: any = {}) {
  return {
    sub: 'test-musician-123',
    role: 'musician',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
    ...overrides,
  };
}

/**
 * Helper to create test jam data
 */
export function createTestJamData(overrides: any = {}) {
  return {
    id: 'jam-test-' + Math.random().toString(36).substr(2, 9),
    name: 'Test Jam',
    data: new Date(),
    local: 'Test Venue',
    hostMusicianId: 'host-test-123',
    hostNome: 'Test Host',
    hostContato: '1234567890',
    qrCode: 'test-qr-code',
    ...overrides,
  };
}

/**
 * Helper to create test musician data
 */
export function createTestMusicianData(overrides: any = {}) {
  return {
    id: 'musician-test-' + Math.random().toString(36).substr(2, 9),
    name: 'Test Musician',
    email: 'test@example.com',
    phone: '1234567890',
    instrument: 'guitar',
    level: 'INTERMEDIATE',
    ...overrides,
  };
}

/**
 * Helper to create test music data
 */
export function createTestMusicData(overrides: any = {}) {
  return {
    id: 'music-test-' + Math.random().toString(36).substr(2, 9),
    nome: 'Test Song',
    duracao: 180,
    status: 'approved',
    description: 'Test song',
    link: 'https://example.com/song',
    neededDrums: 1,
    neededGuitars: 2,
    neededVocals: 1,
    neededBass: 1,
    neededKeys: 0,
    ...overrides,
  };
}

/**
 * Helper to create test registration data
 */
export function createTestInscricaoData(overrides: any = {}) {
  return {
    id: 'inscricao-test-' + Math.random().toString(36).substr(2, 9),
    jamId: 'jam-test-123',
    musicianId: 'musician-test-123',
    instrumento: 'guitar',
    nivel: 'INTERMEDIATE',
    status: 'PENDING',
    ...overrides,
  };
}

/**
 * Helper to create test schedule data
 */
export function createTestEscalaData(overrides: any = {}) {
  return {
    id: 'escala-test-' + Math.random().toString(36).substr(2, 9),
    musicId: 'music-test-123',
    jamId: 'jam-test-123',
    order: 1,
    status: 'SUGGESTED',
    inscricaoId: null,
    ...overrides,
  };
}

/**
 * Wait for async operations to complete
 */
export async function waitFor(
  condition: () => boolean,
  timeout: number = 1000,
  interval: number = 10,
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * Simulate rate limit window expiration
 */
export function expireRateLimitWindow(gateway: any, clientId: string) {
  const limit = gateway['messageRateLimits'].get(clientId);
  if (limit) {
    limit.lastReset = Date.now() - 2000; // 2 seconds ago
  }
}

/**
 * Get all emitted events for a socket
 */
export function getEmittedEvents(socket: any): Array<{ event: string; args: any[] }> {
  return socket.emit.mock.calls.map(([event, ...args]: any[]) => ({
    event,
    args,
  }));
}

/**
 * Get all joined rooms for a socket
 */
export function getJoinedRooms(socket: any): string[] {
  return socket.join.mock.calls.map(([room]: any[]) => room);
}

/**
 * Clear all mocks for a socket
 */
export function clearSocketMocks(socket: any) {
  socket.join.mockClear();
  socket.leave.mockClear();
  socket.emit.mockClear();
  socket.on.mockClear();
}

