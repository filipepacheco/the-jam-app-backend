import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJamDto } from './dto/create-jam.dto';
import { UpdateJamDto } from './dto/update-jam.dto';
import * as QRCode from 'qrcode';

@Injectable()
export class JamService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async create(createJamDto: CreateJamDto) {
    let hostName = createJamDto.hostName;
    let hostContact = createJamDto.hostContact;

    if (createJamDto.hostMusicianId) {
      const hostMusician = await this.prisma.musician.findUnique({
        where: { id: createJamDto.hostMusicianId },
      });

      if (!hostMusician) {
        throw new BadRequestException('Host musician not found');
      }

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
    payload?: { updates?: { scheduleId: string; order: number }[] },
  ) {
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
        updatedJam = await this.findOne(jamId);
        break;

      case 'skip': {
        const currentSchedule = await this.prisma.schedule.findFirst({
          where: { jamId, status: 'IN_PROGRESS' },
        });

        if (currentSchedule) {
          await this.prisma.schedule.update({
            where: { id: currentSchedule.id },
            data: { status: 'COMPLETED' },
          });
        }

        const nextSchedule = await this.prisma.schedule.findFirst({
          where: { jamId, status: 'SCHEDULED' },
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
      }

      case 'reorder':
        if (!payload?.updates || payload.updates.length === 0) {
          throw new BadRequestException('updates array is required for reorder action');
        }

        // Execute reorder inline since the method moved to JamPlaybackService
        await this.prisma.$transaction(
          payload.updates.map(({ scheduleId, order }) =>
            this.prisma.schedule.update({
              where: { id: scheduleId },
              data: { order },
            }),
          ),
        );
        updatedJam = await this.findOne(jamId);
        break;

      default:
        throw new BadRequestException('Invalid action');
    }

    return updatedJam;
  }
}
