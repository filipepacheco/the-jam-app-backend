import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJamDto } from './dto/create-jam.dto';
import { UpdateJamDto } from './dto/update-jam.dto';
import { LiveStateResponseDto } from './dto/live-state-response.dto';
import { LiveDashboardResponseDto, DashboardSongDto } from './dto/live-dashboard-response.dto';
import * as QRCode from 'qrcode';
import { PlaybackState, PlaybackAction, Prisma } from '@prisma/client';
import { DEFAULT_HISTORY_LIMIT } from '../common/constants';

@Injectable()
export class JamService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async create(createJamDto: CreateJamDto) {
    // If hostMusicianId is provided, validate it exists and denormalize host info
    let hostName = createJamDto.hostName;
    let hostContact = createJamDto.hostContact;

    if (createJamDto.hostMusicianId) {
      const hostMusician = await this.prisma.musician.findUnique({
        where: { id: createJamDto.hostMusicianId },
      });

      if (!hostMusician) {
        throw new BadRequestException('Host musician not found');
      }

      // Denormalize host info from musician
      hostName = hostName || hostMusician.name || undefined;
      hostContact = hostContact || hostMusician.contact || undefined;
    }

    const jam = await this.prisma.jam.create({
      data: {
        name: createJamDto.name,
        description: createJamDto.description,
        date: createJamDto.date ? new Date(createJamDto.date) : undefined,
        location: createJamDto.location,
        hostMusicianId: createJamDto.hostMusicianId,
        hostName,
        hostContact,
        status: createJamDto.status,
      },
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const qrCodeUrl = `${frontendUrl}/jam/${jam.id}`;
    const qrCode = await QRCode.toDataURL(qrCodeUrl);

    return this.prisma.jam.update({
      where: { id: jam.id },
      data: { qrCode },
    });
  }

  async findAll(skip = 0, take = 20) {
    const [data, total] = await Promise.all([
      this.prisma.jam.findMany({
        skip,
        take,
        select: {
          id: true,
          name: true,
          description: true,
          date: true,
          qrCode: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          hostName: true,
          playbackState: true,
          currentScheduleId: true,
          _count: {
            select: {
              jamMusics: true,
              registrations: true,
              schedules: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.jam.count(),
    ]);

    return {
      data,
      meta: {
        total,
        skip,
        take,
        hasMore: skip + take < total,
      },
    };
  }

  async findOne(id: string) {
    const jam = await this.prisma.jam.findUnique({
      where: { id },
      include: {
        jamMusics: {
          include: {
            music: true,
            registrations: {
              include: { musician: true },
            },
          },
        },
        registrations: { include: { musician: true } },
        schedules: {
          include: {
            music: true,
            registrations: {
              include: { musician: true },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!jam) return null;

    // Reorganize: schedules > music > registrations
    const schedulesWithDetails = jam.schedules.map((schedule) => {
      return {
        ...schedule,
        music: schedule.music,
        registrations: schedule.registrations || [],
      };
    });

    return {
      ...jam,
      schedules: schedulesWithDetails,
    };
  }

  async getLiveState(jamId: string): Promise<LiveStateResponseDto> {
    const jam = await this.findOne(jamId);

    if (!jam) {
      throw new NotFoundException(`Jam with ID ${jamId} not found`);
    }

    const currentSong = jam.schedules?.find((s) => s.status === 'IN_PROGRESS') || null;

    const nextSongs =
      jam.schedules?.filter((s) => s.status === 'SCHEDULED').sort((a, b) => a.order - b.order) ||
      [];

    const previousSongs =
      jam.schedules
        ?.filter((s) => s.status === 'COMPLETED')
        .sort((a, b) => b.order - a.order)
        .reverse() || [];

    const suggestedSongs =
      jam.schedules?.filter((s) => s.status === 'SUGGESTED').sort((a, b) => a.order - b.order) ||
      [];

    return {
      currentSong,
      nextSongs,
      previousSongs,
      suggestedSongs,
      jamStatus: jam.status,
      playbackState: jam.playbackState || 'STOPPED',
      currentSongStartedAt: currentSong?.startedAt || null,
      currentSongPausedAt: currentSong?.pausedAt || null,
      timestamp: Date.now(),
    };
  }

  async update(id: string, updateJamDto: UpdateJamDto) {
    return this.prisma.jam.update({
      where: { id },
      data: updateJamDto,
    });
  }

  async remove(id: string) {
    return this.prisma.jam.delete({
      where: { id },
    });
  }

  async executeLiveAction(
    jamId: string,
    action: 'play' | 'pause' | 'skip' | 'reorder',
    payload?: { updates?: { scheduleId: string; order: number }[] },
  ) {
    // Verify jam exists and is ACTIVE or LIVE
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    if (jam.status !== 'ACTIVE' && jam.status !== 'LIVE') {
      throw new BadRequestException('Jam is not active or live');
    }

    let updatedJam;

    switch (action) {
      case 'play':
      case 'pause':
        // UI-only state, no DB change
        updatedJam = await this.findOne(jamId);
        break;

      case 'skip':
        // Mark current IN_PROGRESS as COMPLETED, mark next SCHEDULED as IN_PROGRESS
        const currentSchedule = await this.prisma.schedule.findFirst({
          where: {
            jamId,
            status: 'IN_PROGRESS',
          },
        });

        if (currentSchedule) {
          await this.prisma.schedule.update({
            where: { id: currentSchedule.id },
            data: { status: 'COMPLETED' },
          });
        }

        // Find next schedule with SCHEDULED status, ordered by order ASC
        const nextSchedule = await this.prisma.schedule.findFirst({
          where: {
            jamId,
            status: 'SCHEDULED',
          },
          orderBy: { order: 'asc' },
        });

        if (nextSchedule) {
          await this.prisma.schedule.update({
            where: { id: nextSchedule.id },
            data: { status: 'IN_PROGRESS' },
          });
        }

        updatedJam = await this.findOne(jamId);
        break;

      case 'reorder':
        // Delegate to new reorderSchedules method for proper transaction handling
        if (!payload?.updates || payload.updates.length === 0) {
          throw new BadRequestException('updates array is required for reorder action');
        }

        await this.reorderSchedules(jamId, payload.updates);
        updatedJam = await this.findOne(jamId);
        break;

      default:
        throw new BadRequestException('Invalid action');
    }

    return updatedJam;
  }

  async getLiveDashboard(jamId: string): Promise<LiveDashboardResponseDto> {
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
    });

    if (!jam) {
      throw new NotFoundException(`Jam with ID ${jamId} not found`);
    }

    // Fetch all schedules with their music and only approved musician names
    const schedules = await this.prisma.schedule.findMany({
      where: { jamId },
      select: {
        id: true,
        order: true,
        status: true,
        music: {
          select: {
            id: true,
            title: true,
            artist: true,
            duration: true,
          },
        },
        registrations: {
          select: {
            instrument: true,
            musician: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { order: 'asc' },
    });

    // Find current song (IN_PROGRESS status)
    const currentSchedule = schedules.find((s) => s.status === 'IN_PROGRESS');
    const currentSong: DashboardSongDto | null = currentSchedule
      ? this.mapScheduleToDashboardSong(currentSchedule)
      : null;

    // Find next songs (SCHEDULED status, take first 3)
    const nextSchedules = schedules.filter((s) => s.status === 'SCHEDULED').slice(0, 3);
    const nextSongs = nextSchedules.map((schedule) => this.mapScheduleToDashboardSong(schedule));

    return {
      jamId: jam.id,
      jamName: jam.name,
      qrCode: jam.qrCode,
      jamStatus: jam.status,
      currentSong,
      nextSongs,
    };
  }

  async startJam(jamId: string, userId?: string) {
    // Validate jam exists and is ACTIVE
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
      include: { currentSchedule: true },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    if (jam.status !== 'ACTIVE') {
      throw new BadRequestException('Jam must be ACTIVE to start');
    }

    if (jam.playbackState === PlaybackState.PLAYING) {
      throw new BadRequestException('Jam is already playing');
    }

    // Find first SCHEDULED song
    const firstSchedule = await this.prisma.schedule.findFirst({
      where: {
        jamId,
        status: 'SCHEDULED',
      },
      orderBy: { order: 'asc' },
    });

    if (!firstSchedule) {
      throw new BadRequestException('No songs scheduled to play');
    }

    // Update first song to IN_PROGRESS and set startedAt
    await this.prisma.schedule.update({
      where: { id: firstSchedule.id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    // Update jam: set status to LIVE, playbackState to PLAYING and currentScheduleId
    const updatedJam = await this.prisma.jam.update({
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

    // Record history
    await this.recordPlaybackHistory(jamId, firstSchedule.id, PlaybackAction.START_JAM, userId, {
      firstSongId: firstSchedule.id,
    });

    return updatedJam;
  }

  async stopJam(jamId: string, userId?: string) {
    // Validate jam exists
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
      include: { currentSchedule: true },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    if (jam.playbackState === PlaybackState.STOPPED) {
      throw new BadRequestException('Jam is already stopped');
    }

    const scheduleId = jam.currentScheduleId;

    // If there's a current song, mark it as COMPLETED
    if (jam.currentScheduleId) {
      await this.prisma.schedule.update({
        where: { id: jam.currentScheduleId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          pausedAt: null,
        },
      });
    }

    // Update jam: set status to FINISHED, playbackState to STOPPED and clear currentScheduleId
    const updatedJam = await this.prisma.jam.update({
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

    // Record history
    if (scheduleId) {
      await this.recordPlaybackHistory(jamId, scheduleId, PlaybackAction.STOP_JAM, userId);
    }

    return updatedJam;
  }

  async nextSong(jamId: string, userId?: string) {
    // Validate jam exists and is playing or paused
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
      include: { currentSchedule: true },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    if (!jam.currentScheduleId) {
      throw new BadRequestException('No current song playing');
    }

    if (jam.playbackState === PlaybackState.STOPPED) {
      throw new BadRequestException('Jam is stopped');
    }

    // Mark current song as COMPLETED
    const currentSong = await this.prisma.schedule.findUnique({
      where: { id: jam.currentScheduleId },
    });

    if (currentSong) {
      await this.prisma.schedule.update({
        where: { id: jam.currentScheduleId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          pausedAt: null,
        },
      });
    }

    // Find next SCHEDULED song
    const nextSchedule = await this.prisma.schedule.findFirst({
      where: {
        jamId,
        status: 'SCHEDULED',
      },
      orderBy: { order: 'asc' },
    });

    let newPlaybackState: PlaybackState = PlaybackState.PLAYING;
    let newScheduleId: string | null = null;

    if (nextSchedule) {
      // Start next song
      await this.prisma.schedule.update({
        where: { id: nextSchedule.id },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          pausedAt: null,
        },
      });
      newScheduleId = nextSchedule.id;
    } else {
      // No more songs, stop jam
      newPlaybackState = PlaybackState.STOPPED;
    }

    // Update jam
    const updatedJam = await this.prisma.jam.update({
      where: { id: jamId },
      data: {
        playbackState: newPlaybackState,
        currentScheduleId: newScheduleId,
      },
      select: {
        id: true,
        playbackState: true,
        currentScheduleId: true,
        updatedAt: true,
      },
    });

    // Record history
    if (currentSong) {
      await this.recordPlaybackHistory(jamId, currentSong.id, PlaybackAction.SKIP_SONG, userId);
    }

    return updatedJam;
  }

  async previousSong(jamId: string, userId?: string) {
    // Validate jam exists and is playing or paused
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
      include: { currentSchedule: true },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    if (!jam.currentScheduleId) {
      throw new BadRequestException('No current song playing');
    }

    if (jam.playbackState === PlaybackState.STOPPED) {
      throw new BadRequestException('Jam is stopped');
    }

    // Mark current song as SCHEDULED (returns to queue)
    const currentSong = await this.prisma.schedule.findUnique({
      where: { id: jam.currentScheduleId },
    });

    if (currentSong) {
      await this.prisma.schedule.update({
        where: { id: jam.currentScheduleId },
        data: {
          status: 'SCHEDULED',
          startedAt: null,
          pausedAt: null,
        },
      });
    }

    // Find previous COMPLETED song (by order DESC)
    const previousSchedule = await this.prisma.schedule.findFirst({
      where: {
        jamId,
        status: 'COMPLETED',
      },
      orderBy: { order: 'desc' },
    });

    let newScheduleId: string;

    if (previousSchedule) {
      // Replay previous song
      await this.prisma.schedule.update({
        where: { id: previousSchedule.id },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          completedAt: null,
          pausedAt: null,
        },
      });
      newScheduleId = previousSchedule.id;
    } else {
      // No previous completed songs, start first SCHEDULED song
      const firstSchedule = await this.prisma.schedule.findFirst({
        where: {
          jamId,
          status: 'SCHEDULED',
        },
        orderBy: { order: 'asc' },
      });

      if (!firstSchedule) {
        throw new BadRequestException('No songs available to play');
      }

      await this.prisma.schedule.update({
        where: { id: firstSchedule.id },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          pausedAt: null,
        },
      });
      newScheduleId = firstSchedule.id;
    }

    // Update jam
    const updatedJam = await this.prisma.jam.update({
      where: { id: jamId },
      data: {
        playbackState: PlaybackState.PLAYING,
        currentScheduleId: newScheduleId,
      },
      select: {
        id: true,
        playbackState: true,
        currentScheduleId: true,
        updatedAt: true,
      },
    });

    // Record history
    if (currentSong) {
      await this.recordPlaybackHistory(jamId, currentSong.id, PlaybackAction.PREVIOUS_SONG, userId);
    }

    return updatedJam;
  }

  async pauseSong(jamId: string, userId?: string) {
    // Validate jam is PLAYING
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
      include: { currentSchedule: true },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    if (jam.playbackState !== PlaybackState.PLAYING) {
      throw new BadRequestException('Jam is not currently playing');
    }

    if (!jam.currentScheduleId) {
      throw new BadRequestException('No current song to pause');
    }

    // Set pausedAt on current schedule
    await this.prisma.schedule.update({
      where: { id: jam.currentScheduleId },
      data: {
        pausedAt: new Date(),
      },
    });

    // Update jam playbackState
    const updatedJam = await this.prisma.jam.update({
      where: { id: jamId },
      data: {
        playbackState: PlaybackState.PAUSED,
      },
      select: {
        id: true,
        playbackState: true,
        currentScheduleId: true,
        updatedAt: true,
      },
    });

    // Record history
    await this.recordPlaybackHistory(
      jamId,
      jam.currentScheduleId,
      PlaybackAction.PAUSE_SONG,
      userId,
    );

    return updatedJam;
  }

  async resumeSong(jamId: string, userId?: string) {
    // Validate jam is PAUSED
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
      include: { currentSchedule: true },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    if (jam.playbackState !== PlaybackState.PAUSED) {
      throw new BadRequestException('Jam is not paused');
    }

    if (!jam.currentScheduleId) {
      throw new BadRequestException('No current song to resume');
    }

    // Clear pausedAt on current schedule
    await this.prisma.schedule.update({
      where: { id: jam.currentScheduleId },
      data: {
        pausedAt: null,
      },
    });

    // Update jam playbackState
    const updatedJam = await this.prisma.jam.update({
      where: { id: jamId },
      data: {
        playbackState: PlaybackState.PLAYING,
      },
      select: {
        id: true,
        playbackState: true,
        currentScheduleId: true,
        updatedAt: true,
      },
    });

    // Record history
    await this.recordPlaybackHistory(
      jamId,
      jam.currentScheduleId,
      PlaybackAction.RESUME_SONG,
      userId,
    );

    return updatedJam;
  }

  async reorderSchedules(
    jamId: string,
    updates: { scheduleId: string; order: number }[],
    userId?: string,
  ): Promise<boolean> {
    if (updates.length === 0) {
      throw new BadRequestException('Updates array cannot be empty');
    }

    // Validate all scheduleIds belong to this jam
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

    // Check for duplicate scheduleIds in payload
    const uniqueIds = new Set(scheduleIds);
    if (uniqueIds.size !== scheduleIds.length) {
      throw new BadRequestException('Duplicate schedule IDs in payload');
    }

    // Execute batch update in transaction
    await this.prisma.$transaction(
      updates.map(({ scheduleId, order }) =>
        this.prisma.schedule.update({
          where: { id: scheduleId },
          data: { order },
        }),
      ),
    );

    // Record playback history
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
      select: { currentScheduleId: true },
    });

    const scheduleIdForHistory = jam?.currentScheduleId || scheduleIds[0];
    await this.prisma.playbackHistory.create({
      data: {
        jamId,
        scheduleId: scheduleIdForHistory,
        action: PlaybackAction.REORDER_QUEUE,
        userId,
        metadata: {
          updates,
          totalUpdates: updates.length,
        },
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
    // Validate jam exists
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    // Get playback history with selective music and musician fields
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
            music: {
              select: {
                title: true,
                artist: true,
              },
            },
            registrations: {
              where: { status: 'APPROVED' },
              select: {
                musician: {
                  select: { name: true },
                },
              },
              take: 1, // Only need first performer
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

  private async recordPlaybackHistory(
    jamId: string,
    scheduleId: string,
    action: PlaybackAction,
    userId?: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.playbackHistory.create({
      data: {
        jamId,
        scheduleId,
        action,
        userId,
        metadata,
      },
    });
  }

  private mapScheduleToDashboardSong(schedule: any): DashboardSongDto {
    return {
      id: schedule.music.id,
      title: schedule.music.title,
      artist: schedule.music.artist,
      duration: schedule.music.duration,
      musicians: schedule.registrations.map((reg: any) => ({
        id: reg.musician.id,
        name: reg.musician.name,
        instrument: reg.instrument,
      })),
    };
  }
}
