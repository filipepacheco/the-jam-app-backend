import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlaybackState, PlaybackAction, Prisma } from '@prisma/client';
import { DEFAULT_HISTORY_LIMIT } from '../common/constants';

@Injectable()
export class JamPlaybackService {
  constructor(private prisma: PrismaService) {}

  private validateHostOwnership(jam: { hostMusicianId: string | null }, musicianId?: string): void {
    if (musicianId && jam.hostMusicianId && jam.hostMusicianId !== musicianId) {
      throw new ForbiddenException('Only the jam host can control playback');
    }
  }

  async startJam(jamId: string, userId?: string) {
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
      include: { currentSchedule: true },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    this.validateHostOwnership(jam, userId);

    if (jam.status !== 'ACTIVE') {
      throw new BadRequestException('Jam must be ACTIVE to start');
    }

    if (jam.playbackState === PlaybackState.PLAYING) {
      throw new BadRequestException('Jam is already playing');
    }

    const firstSchedule = await this.prisma.schedule.findFirst({
      where: { jamId, status: 'SCHEDULED' },
      orderBy: { order: 'asc' },
    });

    if (!firstSchedule) {
      throw new BadRequestException('No songs scheduled to play');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.schedule.update({
        where: { id: firstSchedule.id },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
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
        data: { jamId, scheduleId: firstSchedule.id, action: PlaybackAction.START_JAM, userId, metadata: { firstSongId: firstSchedule.id } },
      });

      return updatedJam;
    });
  }

  async stopJam(jamId: string, userId?: string) {
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
      include: { currentSchedule: true },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    this.validateHostOwnership(jam, userId);

    if (jam.playbackState === PlaybackState.STOPPED) {
      throw new BadRequestException('Jam is already stopped');
    }

    const scheduleId = jam.currentScheduleId;

    return this.prisma.$transaction(async (tx) => {
      if (scheduleId) {
        await tx.schedule.update({
          where: { id: scheduleId },
          data: { status: 'COMPLETED', completedAt: new Date(), pausedAt: null },
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
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
      include: { currentSchedule: true },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    this.validateHostOwnership(jam, userId);

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
          data: { status: 'COMPLETED', completedAt: new Date(), pausedAt: null },
        });
      }

      const nextSchedule = await tx.schedule.findFirst({
        where: { jamId, status: 'SCHEDULED' },
        orderBy: { order: 'asc' },
      });

      let newPlaybackState: PlaybackState = PlaybackState.PLAYING;
      let newScheduleId: string | null = null;

      if (nextSchedule) {
        await tx.schedule.update({
          where: { id: nextSchedule.id },
          data: { status: 'IN_PROGRESS', startedAt: new Date(), pausedAt: null },
        });
        newScheduleId = nextSchedule.id;
      } else {
        newPlaybackState = PlaybackState.STOPPED;
      }

      const updatedJam = await tx.jam.update({
        where: { id: jamId },
        data: { playbackState: newPlaybackState, currentScheduleId: newScheduleId },
        select: {
          id: true,
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
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
      include: { currentSchedule: true },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    this.validateHostOwnership(jam, userId);

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
          data: { status: 'SCHEDULED', startedAt: null, pausedAt: null },
        });
      }

      const previousSchedule = await tx.schedule.findFirst({
        where: { jamId, status: 'COMPLETED' },
        orderBy: { order: 'desc' },
      });

      let newScheduleId: string;

      if (previousSchedule) {
        await tx.schedule.update({
          where: { id: previousSchedule.id },
          data: { status: 'IN_PROGRESS', startedAt: new Date(), completedAt: null, pausedAt: null },
        });
        newScheduleId = previousSchedule.id;
      } else {
        const firstSchedule = await tx.schedule.findFirst({
          where: { jamId, status: 'SCHEDULED' },
          orderBy: { order: 'asc' },
        });

        if (!firstSchedule) {
          throw new BadRequestException('No songs available to play');
        }

        await tx.schedule.update({
          where: { id: firstSchedule.id },
          data: { status: 'IN_PROGRESS', startedAt: new Date(), pausedAt: null },
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
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
      include: { currentSchedule: true },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    this.validateHostOwnership(jam, userId);

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
        data: { jamId, scheduleId: jam.currentScheduleId, action: PlaybackAction.PAUSE_SONG, userId },
      });

      return updatedJam;
    });
  }

  async resumeSong(jamId: string, userId?: string) {
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
      include: { currentSchedule: true },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    this.validateHostOwnership(jam, userId);

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
        data: { jamId, scheduleId: jam.currentScheduleId, action: PlaybackAction.RESUME_SONG, userId },
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

    const jam = await this.prisma.jam.findUnique({ where: { id: jamId } });
    if (!jam) {
      throw new NotFoundException('Jam not found');
    }
    this.validateHostOwnership(jam, userId);

    const scheduleIds = updates.map((u) => u.scheduleId);
    const schedules = await this.prisma.schedule.findMany({
      where: { id: { in: scheduleIds }, jamId },
      select: { id: true },
    });

    if (schedules.length !== scheduleIds.length) {
      const foundIds = new Set(schedules.map((s) => s.id));
      const invalidIds = scheduleIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(`Invalid schedule IDs: ${invalidIds.join(', ')}`);
    }

    const uniqueIds = new Set(scheduleIds);
    if (uniqueIds.size !== scheduleIds.length) {
      throw new BadRequestException('Duplicate schedule IDs in payload');
    }

    await this.prisma.$transaction(
      updates.map(({ scheduleId, order }) =>
        this.prisma.schedule.update({
          where: { id: scheduleId },
          data: { order },
        }),
      ),
    );

    const scheduleIdForHistory = jam.currentScheduleId || scheduleIds[0];
    await this.prisma.playbackHistory.create({
      data: {
        jamId,
        scheduleId: scheduleIdForHistory,
        action: PlaybackAction.REORDER_QUEUE,
        userId,
        metadata: { updates, totalUpdates: updates.length },
      },
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
    const jam = await this.prisma.jam.findUnique({ where: { id: jamId } });

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
              where: { status: 'APPROVED' },
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
