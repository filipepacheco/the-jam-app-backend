import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJamDto } from './dto/create-jam.dto';
import { UpdateJamDto } from './dto/update-jam.dto';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import * as QRCode from 'qrcode';

@Injectable()
export class JamService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => WebsocketGateway))
    private websocketGateway: WebsocketGateway,
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

  async insertMusica(jamId: string, musicId: string) {
    await this.prisma.jam.update({
        where: { id: jamId },
        data: {
            jamMusics: {
                create: { musicId }
            }
        }
    })
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

    // Broadcast updated jam to all connected clients in jam room
    this.websocketGateway.broadcastJamUpdate(jamId, updatedJam);

    return updatedJam;
  }
}
