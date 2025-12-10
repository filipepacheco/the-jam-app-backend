import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJamDto } from './dto/create-jam.dto';
import { UpdateJamDto } from './dto/update-jam.dto';
import * as QRCode from 'qrcode';

@Injectable()
export class JamService {
  constructor(private prisma: PrismaService) {}

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
}
