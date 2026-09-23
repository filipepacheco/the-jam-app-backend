import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlaybackState, PlaybackAction, ScheduleStatus, Prisma, JamStatus } from '@prisma/client';
import { DEFAULT_HISTORY_LIMIT } from '../common/constants';
import { lockJamQueue } from '../escala/queue-lock';
import { queueRevision } from './queue-revision';
import { writeQueueOrder } from './queue-order';

/** Minimal fields needed for playback state checks */
const PLAYBACK_JAM_SELECT = {
  id: true,
  status: true,
  playbackState: true,
  currentScheduleId: true,
  resumeFromQueue: true,
} as const;

type PlaybackJam = Prisma.JamGetPayload<{ select: typeof PLAYBACK_JAM_SELECT }>;

const MAX_QUEUE_ORDER = 2_147_483_647;

@Injectable()
export class JamPlaybackService {
  constructor(private prisma: PrismaService) {}

  /**
   * The jam row is the serialization point for every playback command. Read
   * the state only after acquiring it, otherwise concurrent commands can make
   * decisions from the same stale currentScheduleId/playbackState snapshot.
   */
  private async withLockedPlaybackJam<T>(
    jamId: string,
    transition: (tx: Prisma.TransactionClient, jam: PlaybackJam) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await lockJamQueue(tx, jamId);
      const jam = await tx.jam.findUnique({ where: { id: jamId }, select: PLAYBACK_JAM_SELECT });
      if (!jam) throw new NotFoundException('Jam not found');
      return transition(tx, jam);
    });
  }

  private async readCurrentActiveSchedule(tx: Prisma.TransactionClient, jam: PlaybackJam) {
    if (!jam.currentScheduleId) {
      throw new BadRequestException('No current song playing');
    }
    const schedule = await tx.schedule.findFirst({
      where: { id: jam.currentScheduleId, jamId: jam.id },
    });
    if (!schedule || schedule.status !== ScheduleStatus.IN_PROGRESS) {
      throw new ConflictException('Playback state is inconsistent; repair required');
    }
    return schedule;
  }

  private async releaseInactiveSchedules(tx: Prisma.TransactionClient, jam: PlaybackJam) {
    await tx.schedule.updateMany({
      where: {
        jamId: jam.id,
        status: ScheduleStatus.IN_PROGRESS,
        ...(jam.playbackState !== PlaybackState.STOPPED && jam.currentScheduleId
          ? { id: { not: jam.currentScheduleId } }
          : {}),
      },
      data: { status: ScheduleStatus.SCHEDULED, pausedAt: null },
    });
  }

  async startJam(jamId: string, userId?: string) {
    return this.withLockedPlaybackJam(jamId, async (tx, jam) => {
      if (jam.playbackState === PlaybackState.PLAYING) {
        throw new BadRequestException('Jam is already playing');
      }
      if (jam.playbackState === PlaybackState.PAUSED) {
        throw new BadRequestException('Jam is paused; resume the current song');
      }
      await this.releaseInactiveSchedules(tx, jam);
      const firstSchedule = await tx.schedule.findFirst({
        where: { jamId, status: ScheduleStatus.SCHEDULED },
        orderBy: { order: 'asc' },
      });
      if (!firstSchedule) {
        throw new BadRequestException('No songs scheduled to play');
      }
      await tx.schedule.update({
        where: { id: firstSchedule.id },
        data: { status: ScheduleStatus.IN_PROGRESS, startedAt: new Date() },
      });

      const updatedJam = await tx.jam.update({
        where: { id: jamId },
        data: {
          status: 'LIVE',
          resumeFromQueue: false,
          playbackState: PlaybackState.PLAYING,
          currentScheduleId: firstSchedule.id,
        },
        select: {
          id: true,
          status: true,
          playbackState: true,
          currentScheduleId: true,
          updatedAt: true,
        },
      });

      await tx.playbackHistory.create({
        data: {
          jamId,
          scheduleId: firstSchedule.id,
          action: PlaybackAction.START_JAM,
          userId,
          metadata: { firstSongId: firstSchedule.id },
        },
      });

      return updatedJam;
    });
  }

  async stopJam(jamId: string, userId?: string) {
    return this.withLockedPlaybackJam(jamId, async (tx, jam) => {
      if (jam.playbackState === PlaybackState.STOPPED) {
        throw new BadRequestException('Jam is already stopped');
      }
      const currentSong = await this.readCurrentActiveSchedule(tx, jam);
      await tx.schedule.update({
        where: { id: currentSong.id },
        data: { status: ScheduleStatus.COMPLETED, completedAt: new Date(), pausedAt: null },
      });

      const updatedJam = await tx.jam.update({
        where: { id: jamId },
        data: {
          status: 'FINISHED',
          resumeFromQueue: false,
          playbackState: PlaybackState.STOPPED,
          currentScheduleId: null,
        },
        select: {
          id: true,
          status: true,
          playbackState: true,
          currentScheduleId: true,
          updatedAt: true,
        },
      });

      await tx.playbackHistory.create({
        data: { jamId, scheduleId: currentSong.id, action: PlaybackAction.STOP_JAM, userId },
      });

      return updatedJam;
    });
  }

  async nextSong(jamId: string, userId?: string) {
    return this.withLockedPlaybackJam(jamId, async (tx, jam) => {
      if (jam.playbackState === PlaybackState.STOPPED) {
        throw new BadRequestException('Jam is stopped');
      }
      const currentSong = await this.readCurrentActiveSchedule(tx, jam);
      await tx.schedule.update({
        where: { id: currentSong.id },
        data: { status: ScheduleStatus.COMPLETED, completedAt: new Date(), pausedAt: null },
      });

      const nextSchedule = await tx.schedule.findFirst({
        where: { jamId, status: ScheduleStatus.SCHEDULED },
        orderBy: { order: 'asc' },
      });

      let newPlaybackState: PlaybackState = PlaybackState.PLAYING;
      let newScheduleId: string | null = null;

      if (nextSchedule) {
        await tx.schedule.update({
          where: { id: nextSchedule.id },
          data: { status: ScheduleStatus.IN_PROGRESS, startedAt: new Date(), pausedAt: null },
        });
        newScheduleId = nextSchedule.id;
      } else {
        newPlaybackState = PlaybackState.STOPPED;
      }

      const updatedJam = await tx.jam.update({
        where: { id: jamId },
        data: {
          resumeFromQueue: false,
          playbackState: newPlaybackState,
          currentScheduleId: newScheduleId,
          ...(nextSchedule ? {} : { status: JamStatus.FINISHED }),
        },
        select: {
          id: true,
          status: true,
          playbackState: true,
          currentScheduleId: true,
          updatedAt: true,
        },
      });

      await tx.playbackHistory.create({
        data: { jamId, scheduleId: currentSong.id, action: PlaybackAction.SKIP_SONG, userId },
      });

      return updatedJam;
    });
  }

  async previousSong(jamId: string, userId?: string) {
    return this.withLockedPlaybackJam(jamId, async (tx, jam) => {
      if (jam.playbackState === PlaybackState.STOPPED) {
        throw new BadRequestException('Jam is stopped');
      }
      const currentSong = await this.readCurrentActiveSchedule(tx, jam);
      await tx.schedule.update({
        where: { id: currentSong.id },
        data: { status: ScheduleStatus.SCHEDULED, startedAt: null, pausedAt: null },
      });

      const previousSchedule = await tx.schedule.findFirst({
        where: { jamId, status: ScheduleStatus.COMPLETED },
        orderBy: { order: 'desc' },
      });

      let newScheduleId: string;

      if (previousSchedule) {
        await tx.schedule.update({
          where: { id: previousSchedule.id },
          data: {
            status: ScheduleStatus.IN_PROGRESS,
            startedAt: new Date(),
            completedAt: null,
            pausedAt: null,
          },
        });
        newScheduleId = previousSchedule.id;
      } else {
        const firstSchedule = await tx.schedule.findFirst({
          where: { jamId, status: ScheduleStatus.SCHEDULED },
          orderBy: { order: 'asc' },
        });

        if (!firstSchedule) {
          throw new BadRequestException('No songs available to play');
        }

        await tx.schedule.update({
          where: { id: firstSchedule.id },
          data: { status: ScheduleStatus.IN_PROGRESS, startedAt: new Date(), pausedAt: null },
        });
        newScheduleId = firstSchedule.id;
      }

      const updatedJam = await tx.jam.update({
        where: { id: jamId },
        data: {
          playbackState: PlaybackState.PLAYING,
          currentScheduleId: newScheduleId,
          resumeFromQueue: false,
        },
        select: {
          id: true,
          playbackState: true,
          currentScheduleId: true,
          updatedAt: true,
        },
      });

      await tx.playbackHistory.create({
        data: { jamId, scheduleId: currentSong.id, action: PlaybackAction.PREVIOUS_SONG, userId },
      });

      return updatedJam;
    });
  }

  async pauseSong(jamId: string, userId?: string) {
    return this.withLockedPlaybackJam(jamId, async (tx, jam) => {
      if (jam.playbackState !== PlaybackState.PLAYING) {
        throw new BadRequestException('Jam is not currently playing');
      }
      const currentSong = await this.readCurrentActiveSchedule(tx, jam);
      await tx.schedule.update({
        where: { id: currentSong.id },
        data: { pausedAt: new Date() },
      });

      const updatedJam = await tx.jam.update({
        where: { id: jamId },
        data: { playbackState: PlaybackState.PAUSED, resumeFromQueue: false },
        select: {
          id: true,
          playbackState: true,
          currentScheduleId: true,
          updatedAt: true,
        },
      });

      await tx.playbackHistory.create({
        data: {
          jamId,
          scheduleId: currentSong.id,
          action: PlaybackAction.PAUSE_SONG,
          userId,
        },
      });

      return updatedJam;
    });
  }

  async resumeSong(jamId: string, userId?: string) {
    return this.withLockedPlaybackJam(jamId, async (tx, jam) => {
      if (jam.playbackState !== PlaybackState.PAUSED) {
        throw new BadRequestException('Jam is not paused');
      }
      const currentSong = jam.resumeFromQueue
        ? await tx.schedule.findFirst({
            where: {
              jamId,
              status: { in: [ScheduleStatus.SCHEDULED, ScheduleStatus.IN_PROGRESS] },
            },
            orderBy: { order: 'asc' },
          })
        : await this.readCurrentActiveSchedule(tx, jam);
      if (!currentSong) throw new BadRequestException('No unfinished songs to play');
      await tx.schedule.updateMany({
        where: { jamId, status: ScheduleStatus.IN_PROGRESS, id: { not: currentSong.id } },
        data: { status: ScheduleStatus.SCHEDULED, pausedAt: null },
      });
      await tx.schedule.update({
        where: { id: currentSong.id },
        data: {
          status: ScheduleStatus.IN_PROGRESS,
          pausedAt: null,
          ...(currentSong.id === jam.currentScheduleId ? {} : { startedAt: new Date() }),
        },
      });
      const updatedJam = await tx.jam.update({
        where: { id: jamId },
        data: {
          playbackState: PlaybackState.PLAYING,
          currentScheduleId: currentSong.id,
          resumeFromQueue: false,
        },
        select: { id: true, playbackState: true, currentScheduleId: true, updatedAt: true },
      });
      await tx.playbackHistory.create({
        data: {
          jamId,
          scheduleId: currentSong.id,
          action: PlaybackAction.RESUME_SONG,
          userId,
          metadata: { fromSavedOrder: jam.resumeFromQueue },
        },
      });

      return updatedJam;
    });
  }

  async reorderSchedules(
    jamId: string,
    updates: { scheduleId: string; order: number }[],
    userId?: string,
    expectedRevision?: string,
  ): Promise<boolean> {
    if (updates.length === 0) {
      throw new BadRequestException('Updates array cannot be empty');
    }

    const scheduleIds = updates.map((u) => u.scheduleId);
    const uniqueIds = new Set(scheduleIds);
    if (uniqueIds.size !== scheduleIds.length) {
      throw new BadRequestException('Duplicate schedule IDs in payload');
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const u of updates) {
      if (
        !uuidRegex.test(u.scheduleId) ||
        !Number.isInteger(u.order) ||
        u.order < -2_147_483_648 ||
        u.order > MAX_QUEUE_ORDER
      ) {
        throw new BadRequestException('Invalid schedule ID or order value');
      }
    }

    const uniqueOrders = new Set(updates.map((u) => u.order));
    if (uniqueOrders.size !== updates.length) {
      throw new BadRequestException('Duplicate order values in payload');
    }

    await this.prisma.$transaction(async (tx) => {
      await lockJamQueue(tx, jamId);

      const [jam, schedules] = await Promise.all([
        tx.jam.findUniqueOrThrow({
          where: { id: jamId },
          select: PLAYBACK_JAM_SELECT,
        }),
        tx.schedule.findMany({
          where: { jamId },
          select: {
            id: true,
            order: true,
            status: true,
            startedAt: true,
            completedAt: true,
            pausedAt: true,
          },
          orderBy: { order: 'asc' },
        }),
      ]);
      const schedulesById = new Map(schedules.map((schedule) => [schedule.id, schedule]));
      const invalidIds = scheduleIds.filter((id) => !schedulesById.has(id));
      if (invalidIds.length > 0) {
        throw new BadRequestException(`Invalid schedule IDs: ${invalidIds.join(', ')}`);
      }

      if (expectedRevision && queueRevision(jam, schedules) !== expectedRevision) {
        throw new ConflictException('The Live Queue changed. Reload it and reapply your order.');
      }
      const requestedIds = new Set(scheduleIds);
      const omittedOrders = new Set(
        schedules.filter((s) => !requestedIds.has(s.id)).map((s) => s.order),
      );
      if (updates.some((u) => omittedOrders.has(u.order))) {
        throw new BadRequestException(
          'Requested position belongs to an omitted song; include it in the reorder',
        );
      }
      const activeUpdate = updates.find((u) => u.scheduleId === jam.currentScheduleId);
      if (
        jam.playbackState === PlaybackState.PLAYING &&
        activeUpdate &&
        activeUpdate.order !== schedulesById.get(activeUpdate.scheduleId)!.order
      ) {
        throw new ConflictException('The playing song must keep its saved position');
      }
      const changed = updates.filter((u) => schedulesById.get(u.scheduleId)!.order !== u.order);
      await this.releaseInactiveSchedules(tx, jam);
      await writeQueueOrder(tx, jamId, changed, schedules);
      await tx.jam.update({
        where: { id: jamId },
        data: {
          ...(changed.length && jam.playbackState === PlaybackState.PAUSED
            ? { resumeFromQueue: true }
            : {}),
          ...(jam.playbackState === PlaybackState.STOPPED ? { currentScheduleId: null } : {}),
        },
      });
      await tx.playbackHistory.create({
        data: {
          jamId,
          scheduleId: jam.currentScheduleId || updates[0].scheduleId,
          action: PlaybackAction.REORDER_QUEUE,
          userId,
          metadata: {
            contractVersion: 2,
            before: schedules.map(({ id, order }) => ({ scheduleId: id, order })),
            updates,
            totalUpdates: updates.length,
          },
        },
      });
    });

    return true;
  }

  async getPlaybackHistory(
    jamId: string,
    limit: number = DEFAULT_HISTORY_LIMIT,
  ): Promise<
    {
      id: string;
      action: PlaybackAction;
      timestamp: Date;
      scheduleId: string;
      songTitle: string;
      songArtist: string;
      performedBy: string | null;
      metadata: Prisma.JsonValue;
    }[]
  > {
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId, deletedAt: null },
      select: { id: true },
    });
    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    const history = await this.prisma.playbackHistory.findMany({
      where: { jamId },
      select: {
        id: true,
        action: true,
        timestamp: true,
        scheduleId: true,
        metadata: true,
        schedule: {
          select: {
            music: { select: { title: true, artist: true } },
            registrations: {
              where: { status: 'APPROVED' as const },
              select: { musician: { select: { name: true } } },
              take: 1,
            },
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return history.map((entry) => ({
      id: entry.id,
      action: entry.action,
      timestamp: entry.timestamp,
      scheduleId: entry.scheduleId,
      songTitle: entry.schedule?.music?.title || 'Unknown',
      songArtist: entry.schedule?.music?.artist || 'Unknown',
      performedBy: entry.schedule?.registrations?.[0]?.musician?.name || null,
      metadata: entry.metadata,
    }));
  }
}
