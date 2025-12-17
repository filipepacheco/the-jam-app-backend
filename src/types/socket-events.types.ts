/**
 * Socket.IO Event Type Definitions and Documentation
 *
 * This file defines all WebSocket events with TypeScript interfaces.
 * Used by both backend and frontend for type-safe socket operations.
 *
 * Generated from: asyncapi.yaml
 * Last Updated: 2025-12-17
 */

/**
 * ==============================================================
 * SHARED SCHEMAS / DATA TYPES
 * ==============================================================
 */

export interface Musician {
  id: string;
  name: string;
  instrument?: string;
  contact?: string;
}

export interface Schedule {
  id: string;
  jamId: string;
  musicId: string;
  musicianId: string;
  status: 'pending' | 'ready' | 'performing' | 'completed' | 'cancelled';
  performance?: {
    startedAt?: Date;
    completedAt?: Date | null;
  };
}

export interface Registration {
  id: string;
  jamId: string;
  musicianId: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  songs?: string[];
}

export interface Music {
  id: string;
  title: string;
  artist?: string;
  duration?: number; // in seconds
  key?: string;
  tempo?: number;
}

export interface Jam {
  id: string;
  name: string;
  description?: string;
  status: 'planning' | 'open' | 'active' | 'closed' | 'completed';
  date?: Date;
  location?: string;
  hostMusicianId?: string;
  hostName?: string;
  hostContact?: string;
}

export interface LiveState {
  jamId: string;
  jam: Jam;
  musicians: Musician[];
  schedule: Schedule[];
  registrations: Registration[];
  musics?: Music[];
}

/**
 * ==============================================================
 * CLIENT → SERVER EVENTS (Socket.emit)
 * ==============================================================
 */

/** Join a jam session - can be simple ID or object with token */
export type JoinJamPayload = string | {
  jamId: string;
  token?: string;
};

/** Leave a jam session */
export type LeaveJamPayload = string;

/** Host requests full state sync */
export interface HostRequestStatePayload {
  jamId: string;
}

/** Musician requests state sync */
export interface MusicianRequestStatePayload {
  jamId: string;
}

/** Public viewer requests state sync */
export interface PublicRequestStatePayload {
  jamId: string;
}

/** Musician signals ready to perform */
export interface MusicianReadyPayload {
  jamId: string;
  scheduleId: string;
}

/**
 * Mapping of client event names to their payloads
 * Use with socket.emit<Events>('eventName', payload)
 */
export interface ClientToServerEvents {
  'joinJam': (payload: JoinJamPayload) => void;
  'leaveJam': (payload: LeaveJamPayload) => void;
  'host:request-state': (payload: HostRequestStatePayload) => void;
  'musician:request-state': (payload: MusicianRequestStatePayload) => void;
  'public:request-state': (payload: PublicRequestStatePayload) => void;
  'musician:ready': (payload: MusicianReadyPayload) => void;
}

/**
 * ==============================================================
 * SERVER → CLIENT EVENTS (socket.on)
 * ==============================================================
 */

/** Live state sync - full jam state for client */
export interface LiveStateSyncPayload {
  jamId: string;
  state: LiveState;
  timestamp?: Date;
}

/** Musician connected to jam (host only) */
export interface MusicianConnectedPayload {
  jamId: string;
  musician: Musician;
  timestamp: Date;
}

/** Musician disconnected from jam (host only) */
export interface MusicianDisconnectedPayload {
  jamId: string;
  musicianId: string;
  musicianName?: string;
  disconnectedAt: Date;
}

/** Musician joined jam - broadcast to all */
export interface MusicianJoinedPayload {
  jamId: string;
  musicianId?: string;
  musicianName?: string;
  role: 'host' | 'musician' | 'public';
  timestamp: Date;
}

/** Musician left jam - broadcast to all */
export interface MusicianLeftPayload {
  jamId: string;
  musicianId?: string;
  musicianName?: string;
  role: 'host' | 'musician' | 'public';
  timestamp: Date;
}

/** Musician signaled ready (host only) */
export interface MusicianReadyNotificationPayload {
  jamId: string;
  scheduleId: string;
  musicianId: string;
  musicianName?: string;
  timestamp: Date;
}

/** Schedule created */
export interface ScheduleCreatedPayload {
  jamId: string;
  schedule: Schedule;
}

/** Schedule updated */
export interface ScheduleUpdatedPayload {
  jamId: string;
  scheduleId: string;
  updates: Partial<Schedule>;
}

/** Schedule status changed (musician only) */
export interface ScheduleStatusChangedPayload {
  jamId: string;
  scheduleId: string;
  previousStatus: string;
  newStatus: string;
  timestamp: Date;
}

/** Registration created */
export interface RegistrationCreatedPayload {
  jamId: string;
  registration: Registration;
}

/** Registration approved */
export interface RegistrationApprovedPayload {
  jamId: string;
  registrationId: string;
  musicianId: string;
  scheduleId?: string;
  registration?: Registration;
}

/** Registration rejected */
export interface RegistrationRejectedPayload {
  jamId: string;
  registrationId: string;
  musicianId: string;
  reason?: string;
}

/** Music added to jam */
export interface MusicAddedPayload {
  jamId: string;
  music: Music;
  jamMusic?: any;
}

/** Music updated */
export interface MusicUpdatedPayload {
  jamId: string;
  musicId: string;
  updates: Partial<Music>;
}

/** Jam status updated */
export interface JamStatusUpdatePayload {
  jamId: string;
  status: Jam['status'];
}

/** Current performance update */
export interface CurrentPerformancePayload {
  jamId: string;
  currentSchedule?: Schedule;
  nextSchedules?: Schedule[];
}

/** Generic socket error */
export interface SocketErrorPayload {
  code: string;
  message: string;
  context?: string;
  timestamp: Date;
}

/**
 * Mapping of server event names to their payloads
 * Use with socket.on<Events>('eventName', (payload) => {})
 */
export interface ServerToClientEvents {
  'live:state-sync': (payload: LiveStateSyncPayload) => void;
  'musician:connected': (payload: MusicianConnectedPayload) => void;
  'musician:disconnected': (payload: MusicianDisconnectedPayload) => void;
  'musicianJoined': (payload: MusicianJoinedPayload) => void;
  'musicianLeft': (payload: MusicianLeftPayload) => void;
  'musician:ready': (payload: MusicianReadyNotificationPayload) => void;
  'schedule:created': (payload: ScheduleCreatedPayload) => void;
  'schedule:updated': (payload: ScheduleUpdatedPayload) => void;
  'schedule:status-changed': (payload: ScheduleStatusChangedPayload) => void;
  'registration:created': (payload: RegistrationCreatedPayload) => void;
  'registration:approved': (payload: RegistrationApprovedPayload) => void;
  'registration:rejected': (payload: RegistrationRejectedPayload) => void;
  'music:added': (payload: MusicAddedPayload) => void;
  'music:updated': (payload: MusicUpdatedPayload) => void;
  'jamStatusUpdate': (payload: JamStatusUpdatePayload) => void;
  'currentPerformance': (payload: CurrentPerformancePayload) => void;
  'error': (payload: SocketErrorPayload) => void;
}

/**
 * ==============================================================
 * ROLE-BASED EVENT SUBSCRIPTIONS
 * ==============================================================
 */

/** Events only host receives */
export const HOST_ONLY_EVENTS = [
  'musician:connected',
  'musician:disconnected',
  'musician:ready',
] as const;

/** Events only musicians receive */
export const MUSICIAN_ONLY_EVENTS = [
  'schedule:status-changed',
] as const;

/** Events all roles receive */
export const PUBLIC_EVENTS = [
  'live:state-sync',
  'musicianJoined',
  'musicianLeft',
  'jamStatusUpdate',
  'currentPerformance',
  'schedule:created',
  'schedule:updated',
  'registration:created',
  'music:added',
  'music:updated',
] as const;

/**
 * ==============================================================
 * SOCKET CONNECTION CONFIGURATION
 * ==============================================================
 */

export interface SocketConnectionConfig {
  /** WebSocket server URL */
  url: string;
  /** JWT authentication token */
  token?: string;
  /** Auto-connect on instantiation */
  autoConnect?: boolean;
  /** Connection timeout in ms */
  timeout?: number;
  /** Enable reconnection */
  reconnection?: boolean;
  /** Max reconnection attempts */
  reconnectionAttempts?: number;
  /** Initial reconnection delay in ms */
  reconnectionDelay?: number;
  /** Max reconnection delay in ms */
  reconnectionDelayMax?: number;
}

/**
 * ==============================================================
 * AUTHENTICATION & AUTHORIZATION
 * ==============================================================
 */

export type SocketUserRole = 'host' | 'musician' | 'public';

export interface SocketUser {
  musicianId: string;
  name: string;
  instrument?: string;
  contact?: string;
}

export interface SocketConnectionData {
  musicianId?: string;
  musician?: SocketUser;
  jamId?: string;
  role?: SocketUserRole;
}

/**
 * ==============================================================
 * RATE LIMITING
 * ==============================================================
 */

export const SOCKET_RATE_LIMITS = {
  MAX_MESSAGES_PER_SECOND: 10,
  RATE_LIMIT_WINDOW_MS: 1000,
} as const;

/**
 * ==============================================================
 * ROOM NAMING CONVENTION
 * ==============================================================
 */

export const SOCKET_ROOM_NAMES = {
  /** All participants in a jam: jam-{jamId} */
  jam: (jamId: string) => `jam-${jamId}`,

  /** Host only: jam-{jamId}-host */
  hostOnly: (jamId: string) => `jam-${jamId}-host`,

  /** Musicians only: jam-{jamId}-musicians */
  musiciansOnly: (jamId: string) => `jam-${jamId}-musicians`,

  /** Public viewers: jam-{jamId}-public */
  publicOnly: (jamId: string) => `jam-${jamId}-public`,
} as const;

/**
 * ==============================================================
 * ERROR CODES
 * ==============================================================
 */

export const SOCKET_ERROR_CODES = {
  INVALID_JAM_ID: 'INVALID_JAM_ID',
  JAM_NOT_FOUND: 'JAM_NOT_FOUND',
  MUSICIAN_NOT_AUTHENTICATED: 'MUSICIAN_NOT_AUTHENTICATED',
  MUSICIAN_NOT_FOUND: 'MUSICIAN_NOT_FOUND',
  INVALID_TOKEN: 'INVALID_TOKEN',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  SCHEDULE_NOT_FOUND: 'SCHEDULE_NOT_FOUND',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

