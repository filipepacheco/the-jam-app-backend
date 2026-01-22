import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJamDto } from './dto/create-jam.dto';
import { UpdateJamDto } from './dto/update-jam.dto';
import { LiveDashboardResponseDto, DashboardSongDto } from './dto/live-dashboard-response.dto';
import * as QRCode from 'qrcode';
import { PlaybackState, PlaybackAction, Prisma } from '@prisma/client';

type JamWithDetails = Prisma.JamGetPayload<{
  include: {
    jamMusics: {
      include: {
        music: true;
        registrations: {
          include: { musician: true };
        };
      };
    };
    registrations: { include: { musician: true } };
    schedules: {
      include: {
        music: true;
        registrations: {
          include: { musician: true };
        };
      };
    };
  };
}>;

type ScheduleWithDetails = Prisma.ScheduleGetPayload<{
  include: {
    music: true;
    registrations: {
      include: { musician: true };
    };
  };
}>;

type RegistrationWithMusician = Prisma.RegistrationGetPayload<{
  include: { musician: true };
}>;

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
              include: { musician: true }
            }
          }
        },
        registrations: { include: { musician: true } },
        schedules: {
          include: {
            music: true,
            registrations: {
              include: { musician: true }
            }
          },
          orderBy: { order: 'asc' }
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
    payload?: { scheduleIds?: string[] },
  ) {
    // Verify jam exists and is ACTIVE
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    if (jam.status !== 'ACTIVE') {
      throw new BadRequestException('Jam is not active');
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
        if (!payload?.scheduleIds || payload.scheduleIds.length === 0) {
          throw new BadRequestException('scheduleIds array is required for reorder action');
        }

        updatedJam = await this.reorderSchedules(jamId, payload.scheduleIds);
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

    // Fetch all schedules with their music and all approved registrations
    const schedules = await this.prisma.schedule.findMany({
      where: { jamId },
      include: {
        music: true,
        registrations: {
          where: { status: 'APPROVED' },
          include: { musician: true },
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
    const nextSchedules = schedules
      .filter((s) => s.status === 'SCHEDULED')
      .slice(0, 3);
    const nextSongs = nextSchedules.map((schedule) =>
      this.mapScheduleToDashboardSong(schedule),
    );

    return {
      jamId: jam.id,
      jamName: jam.name,
      qrCode: jam.qrCode,
      jamStatus: jam.status,
      currentSong,
      nextSongs,
    };
  }

  async startJam(jamId: string, userId?: string): Promise<JamWithDetails | null> {
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

    // Update jam: set playbackState to PLAYING and currentScheduleId
    await this.prisma.jam.update({
      where: { id: jamId },
      data: {
        playbackState: PlaybackState.PLAYING,
        currentScheduleId: firstSchedule.id,
      },
      include: { currentSchedule: true },
    });

    // Record history
    await this.recordPlaybackHistory(
      jamId,
      firstSchedule.id,
      PlaybackAction.START_JAM,
      userId,
      { firstSongId: firstSchedule.id },
    );

    return this.findOne(jamId);
  }

  async stopJam(jamId: string, userId?: string): Promise<JamWithDetails | null> {
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

    let scheduleId = jam.currentScheduleId;

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

    // Update jam: set playbackState to STOPPED and clear currentScheduleId
    await this.prisma.jam.update({
      where: { id: jamId },
      data: {
        playbackState: PlaybackState.STOPPED,
        currentScheduleId: null,
      },
    });

    // Record history
    if (scheduleId) {
      await this.recordPlaybackHistory(jamId, scheduleId, PlaybackAction.STOP_JAM, userId);
    }

    return this.findOne(jamId);
  }

  async nextSong(jamId: string, userId?: string): Promise<JamWithDetails | null> {
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
    await this.prisma.jam.update({
      where: { id: jamId },
      data: {
        playbackState: newPlaybackState,
        currentScheduleId: newScheduleId,
      },
    });

    // Record history
    if (currentSong) {
      await this.recordPlaybackHistory(jamId, currentSong.id, PlaybackAction.SKIP_SONG, userId);
    }

    return this.findOne(jamId);
  }

  async previousSong(jamId: string, userId?: string): Promise<JamWithDetails | null> {
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
    await this.prisma.jam.update({
      where: { id: jamId },
      data: {
        playbackState: PlaybackState.PLAYING,
        currentScheduleId: newScheduleId,
      },
    });

    // Record history
    if (currentSong) {
      await this.recordPlaybackHistory(jamId, currentSong.id, PlaybackAction.PREVIOUS_SONG, userId);
    }

    return this.findOne(jamId);
  }

  async pauseSong(jamId: string, userId?: string): Promise<JamWithDetails | null> {
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
    await this.prisma.jam.update({
      where: { id: jamId },
      data: {
        playbackState: PlaybackState.PAUSED,
      },
    });

    // Record history
    await this.recordPlaybackHistory(jamId, jam.currentScheduleId, PlaybackAction.PAUSE_SONG, userId);

    return this.findOne(jamId);
  }

  async resumeSong(jamId: string, userId?: string): Promise<JamWithDetails | null> {
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
    await this.prisma.jam.update({
      where: { id: jamId },
      data: {
        playbackState: PlaybackState.PLAYING,
      },
    });

    // Record history
    await this.recordPlaybackHistory(jamId, jam.currentScheduleId, PlaybackAction.RESUME_SONG, userId);

    return this.findOne(jamId);
  }

  async reorderSchedules(jamId: string, scheduleIds: string[], userId?: string): Promise<boolean> {
    // Get all schedules for this jam (validates jam exists, fetches only needed fields)
    const allSchedules = await this.prisma.schedule.findMany({
      where: { jamId },
      select: { id: true, order: true },
      orderBy: { order: 'asc' },
    });

    if (allSchedules.length === 0) {
      throw new NotFoundException('Jam not found or has no schedules');
    }

    // Validate all provided schedule IDs belong to this jam
    const jamScheduleIds = new Set(allSchedules.map(s => s.id));

    for (const scheduleId of scheduleIds) {
      if (!jamScheduleIds.has(scheduleId)) {
        throw new BadRequestException(`Schedule ID ${scheduleId} does not belong to this jam`);
      }
    }

    // Build complete order: provided IDs first, then missing schedules at end
    const providedScheduleSet = new Set(scheduleIds);
    const missingSchedules = allSchedules.filter(s => !providedScheduleSet.has(s.id));
    const completeOrder = [...scheduleIds, ...missingSchedules.map(s => s.id)];

    await this.prisma.$transaction(async (tx) => {
      // Phase 1: Set to negative values to avoid unique constraint violations
      for (let i = 0; i < completeOrder.length; i++) {
        await tx.schedule.update({
          where: { id: completeOrder[i] },
          data: { order: -(i + 1) },
        });
      }

      // Phase 2: Set to positive final values
      for (let i = 0; i < completeOrder.length; i++) {
        await tx.schedule.update({
          where: { id: completeOrder[i] },
          data: { order: i + 1 },
        });
      }

      // Get current schedule ID efficiently (only fetch what we need)
      const jam = await tx.jam.findUnique({
        where: { id: jamId },
        select: { currentScheduleId: true },
      });

      // Record playback history
      const scheduleIdForHistory = jam?.currentScheduleId || completeOrder[0];
      await tx.playbackHistory.create({
        data: {
          jamId,
          scheduleId: scheduleIdForHistory,
          action: PlaybackAction.REORDER_QUEUE,
          userId,
          metadata: {
            newOrder: scheduleIds,
            totalSchedules: completeOrder.length,
          },
        },
      });
    });

    return true;
  }

  async getPlaybackHistory(jamId: string, limit: number = 50): Promise<{
    id: string;
    action: PlaybackAction;
    timestamp: Date;
    scheduleId: string;
    songTitle: string;
    songArtist: string;
    performedBy: string | null;
    metadata: Prisma.JsonValue;
  }[]> {
    // Validate jam exists
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    // Get playback history with song details
    const history = await this.prisma.playbackHistory.findMany({
      where: { jamId },
      include: {
        schedule: {
          include: {
            music: true,
            registrations: {
              where: { status: 'APPROVED' },
              include: { musician: true },
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
      performedBy:
        entry.schedule?.registrations?.[0]?.musician?.name || null,
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

  private mapScheduleToDashboardSong(schedule: ScheduleWithDetails): DashboardSongDto {
    return {
      id: schedule.music.id,
      title: schedule.music.title,
      artist: schedule.music.artist,
      duration: schedule.music.duration,
      musicians: schedule.registrations.map((reg: RegistrationWithMusician) => ({
        id: reg.musician.id,
        name: reg.musician.name,
        instrument: reg.musician.instrument,
      })),
    };
  }
}
