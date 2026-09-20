import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlaybackState, PlaybackAction, ScheduleStatus, Prisma, JamStatus } from '@prisma/client';
import { DEFAULT_HISTORY_LIMIT } from '../common/constants';
import { lockJamQueue } from '../escala/queue-lock';

/** Minimal fields needed for playback state checks */
const PLAYBACK_JAM_SELECT = {
  id: true,
  status: true,
  playbackState: true,
  currentScheduleId: true,
} as const;

const MAX_QUEUE_ORDER = 2_147_483_647;

@Injectable()
export class JamPlaybackService {
  constructor(private prisma: PrismaService) {}

  private async findJamForPlayback(jamId: string) {
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId, deletedAt: null },
      select: PLAYBACK_JAM_SELECT,
    });
    if (!jam) {
      throw new NotFoundException('Jam not found');
    }
    return jam;
  }

  async startJam(jamId: string, userId?: string) {
    const jam = await this.findJamForPlayback(jamId);

    if (jam.playbackState === PlaybackState.PLAYING) {
      throw new BadRequestException('Jam is already playing');
    }

    if (jam.playbackState === PlaybackState.PAUSED) {
      throw new BadRequestException('Jam is paused; resume the current song');
    }

    const firstSchedule = await this.prisma.schedule.findFirst({
      where: { jamId, status: ScheduleStatus.SCHEDULED },
      orderBy: { order: 'asc' },
    });

    if (!firstSchedule) {
      throw new BadRequestException('No songs scheduled to play');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.schedule.update({
        where: { id: firstSchedule.id },
        data: { status: ScheduleStatus.IN_PROGRESS, startedAt: new Date() },
      });

      const updatedJam = await tx.jam.update({
        where: { id: jamId },
        data: {
          status: 'LIVE',
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
    const jam = await this.findJamForPlayback(jamId);

    if (jam.playbackState === PlaybackState.STOPPED) {
      throw new BadRequestException('Jam is already stopped');
    }

    const scheduleId = jam.currentScheduleId;

    return this.prisma.$transaction(async (tx) => {
      if (scheduleId) {
        await tx.schedule.update({
          where: { id: scheduleId },
          data: { status: ScheduleStatus.COMPLETED, completedAt: new Date(), pausedAt: null },
        });
      }

      const updatedJam = await tx.jam.update({
        where: { id: jamId },
        data: {
          status: 'FINISHED',
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

      if (scheduleId) {
        await tx.playbackHistory.create({
          data: { jamId, scheduleId, action: PlaybackAction.STOP_JAM, userId },
        });
      }

      return updatedJam;
    });
  }

  async nextSong(jamId: string, userId?: string) {
    const jam = await this.findJamForPlayback(jamId);

    if (!jam.currentScheduleId) {
      throw new BadRequestException('No current song playing');
    }

    if (jam.playbackState === PlaybackState.STOPPED) {
      throw new BadRequestException('Jam is stopped');
    }

    return this.prisma.$transaction(async (tx) => {
      const currentSong = await tx.schedule.findUnique({
        where: { id: jam.currentScheduleId },
      });

      if (currentSong) {
        await tx.schedule.update({
          where: { id: jam.currentScheduleId },
          data: { status: ScheduleStatus.COMPLETED, completedAt: new Date(), pausedAt: null },
        });
      }

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

      if (currentSong) {
        await tx.playbackHistory.create({
          data: { jamId, scheduleId: currentSong.id, action: PlaybackAction.SKIP_SONG, userId },
        });
      }

      return updatedJam;
    });
  }

  async previousSong(jamId: string, userId?: string) {
    const jam = await this.findJamForPlayback(jamId);

    if (!jam.currentScheduleId) {
      throw new BadRequestException('No current song playing');
    }

    if (jam.playbackState === PlaybackState.STOPPED) {
      throw new BadRequestException('Jam is stopped');
    }

    return this.prisma.$transaction(async (tx) => {
      const currentSong = await tx.schedule.findUnique({
        where: { id: jam.currentScheduleId },
      });

      if (currentSong) {
        await tx.schedule.update({
          where: { id: jam.currentScheduleId },
          data: { status: ScheduleStatus.SCHEDULED, startedAt: null, pausedAt: null },
        });
      }

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
        data: { playbackState: PlaybackState.PLAYING, currentScheduleId: newScheduleId },
        select: {
          id: true,
          playbackState: true,
          currentScheduleId: true,
          updatedAt: true,
        },
      });

      if (currentSong) {
        await tx.playbackHistory.create({
          data: { jamId, scheduleId: currentSong.id, action: PlaybackAction.PREVIOUS_SONG, userId },
        });
      }

      return updatedJam;
    });
  }

  async pauseSong(jamId: string, userId?: string) {
    const jam = await this.findJamForPlayback(jamId);

    if (jam.playbackState !== PlaybackState.PLAYING) {
      throw new BadRequestException('Jam is not currently playing');
    }

    if (!jam.currentScheduleId) {
      throw new BadRequestException('No current song to pause');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.schedule.update({
        where: { id: jam.currentScheduleId },
        data: { pausedAt: new Date() },
      });

      const updatedJam = await tx.jam.update({
        where: { id: jamId },
        data: { playbackState: PlaybackState.PAUSED },
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
          scheduleId: jam.currentScheduleId,
          action: PlaybackAction.PAUSE_SONG,
          userId,
        },
      });

      return updatedJam;
    });
  }

  async resumeSong(jamId: string, userId?: string) {
    const jam = await this.findJamForPlayback(jamId);

    if (jam.playbackState !== PlaybackState.PAUSED) {
      throw new BadRequestException('Jam is not paused');
    }

    if (!jam.currentScheduleId) {
      throw new BadRequestException('No current song to resume');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.schedule.update({
        where: { id: jam.currentScheduleId },
        data: { pausedAt: null },
      });

      const updatedJam = await tx.jam.update({
        where: { id: jamId },
        data: { playbackState: PlaybackState.PLAYING },
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
          scheduleId: jam.currentScheduleId,
          action: PlaybackAction.RESUME_SONG,
          userId,
        },
      });

      return updatedJam;
    });
  }

  async reorderSchedules(
    jamId: string,
    updates: { scheduleId: string; order: number }[],
    userId?: string,
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
      if (!uuidRegex.test(u.scheduleId) || !Number.isInteger(u.order) || u.order < 1) {
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
          select: { currentScheduleId: true },
        }),
        tx.schedule.findMany({
          where: { jamId },
          select: { id: true, order: true },
          orderBy: { order: 'asc' },
        }),
      ]);
      const schedulesById = new Map(schedules.map((schedule) => [schedule.id, schedule]));
      const invalidIds = scheduleIds.filter((id) => !schedulesById.has(id));
      if (invalidIds.length > 0) {
        throw new BadRequestException(`Invalid schedule IDs: ${invalidIds.join(', ')}`);
      }

      const requestedIds = new Set(scheduleIds);
      const requestedSchedules = [...updates]
        .sort((left, right) => left.order - right.order)
        .map((update) => schedulesById.get(update.scheduleId)!);
      const omittedSchedules = schedules.filter((schedule) => !requestedIds.has(schedule.id));
      const reorderedSchedules = [...requestedSchedules, ...omittedSchedules];

      // Use unoccupied temporary positions so immediate uniqueness checks permit
      // swaps, including legacy queues already at either PostgreSQL integer limit.
      const occupiedOrders = new Set(schedules.map((schedule) => schedule.order));
      let temporaryOrder = -2_147_483_648;
      const temporaryCases = reorderedSchedules.map((schedule) => {
        while (
          occupiedOrders.has(temporaryOrder) ||
          (temporaryOrder >= 1 && temporaryOrder <= reorderedSchedules.length)
        ) {
          temporaryOrder++;
        }
        if (temporaryOrder > MAX_QUEUE_ORDER) {
          throw new BadRequestException('No temporary queue positions available');
        }
        const position = temporaryOrder++;
        return Prisma.sql`WHEN "id" = ${schedule.id} THEN ${position}`;
      });
      await tx.$executeRaw(
        Prisma.sql`UPDATE "escalas" SET "ordem" = CASE ${Prisma.join(temporaryCases, ' ')} END WHERE "jamId" = ${jamId}`,
      );

      const cases = reorderedSchedules.map(
        (schedule, index) => Prisma.sql`WHEN "id" = ${schedule.id} THEN ${index + 1}`,
      );
      await tx.$executeRaw(
        Prisma.sql`UPDATE "escalas" SET "ordem" = CASE ${Prisma.join(cases, ' ')} END WHERE "jamId" = ${jamId}`,
      );

      await tx.playbackHistory.create({
        data: {
          jamId,
          scheduleId: jam.currentScheduleId || reorderedSchedules[0].id,
          action: PlaybackAction.REORDER_QUEUE,
          userId,
          metadata: { updates, totalUpdates: updates.length },
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
