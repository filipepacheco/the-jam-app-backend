import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJamDto } from './dto/create-jam.dto';
import { UpdateJamDto } from './dto/update-jam.dto';
import { LiveDashboardResponseDto, DashboardSongDto } from './dto/live-dashboard-response.dto';
import * as QRCode from 'qrcode';

@Injectable()
export class JamService {
  constructor(
    private prisma: PrismaService,
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

    const qrCodeUrl = `${process.env.FRONTEND_URL}/jam/${jam.id}`;
    const qrCode = await QRCode.toDataURL(qrCodeUrl);

    return this.prisma.jam.update({
      where: { id: jam.id },
      data: { qrCode },
    });
  }

  async findAll() {
    return this.prisma.jam.findMany({
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
          }
        },
      },
    });
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
        // Update order field for provided schedule IDs in sequence
        if (!payload?.scheduleIds || payload.scheduleIds.length === 0) {
          throw new BadRequestException('scheduleIds array is required for reorder action');
        }

        // Validate all scheduleIds belong to this jam
        const schedules = await this.prisma.schedule.findMany({
          where: {
            id: { in: payload.scheduleIds },
            jamId,
          },
        });

        if (schedules.length !== payload.scheduleIds.length) {
          throw new BadRequestException('One or more schedule IDs do not belong to this jam');
        }

        // Update order for each schedule based on position in array
        for (let i = 0; i < payload.scheduleIds.length; i++) {
          await this.prisma.schedule.update({
            where: { id: payload.scheduleIds[i] },
            data: { order: i + 1 },
          });
        }

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

  private mapScheduleToDashboardSong(schedule: any): DashboardSongDto {
    return {
      id: schedule.music.id,
      title: schedule.music.title,
      artist: schedule.music.artist,
      duration: schedule.music.duration,
      musicians: schedule.registrations.map((reg: any) => ({
        id: reg.musician.id,
        name: reg.musician.name,
        instrument: reg.musician.instrument,
      })),
    };
  }
}
