import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMusicianDto } from './dto/create-musico.dto';
import { UpdateMusicianDto } from './dto/update-musico.dto';
import { normalizeInstrument } from '../common/constants';

@Injectable()
export class MusicoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createMusicianDto: CreateMusicianDto) {
    return this.prisma.musician.create({
      data: {
        ...createMusicianDto,
        instrument: normalizeInstrument(createMusicianDto.instrument) ?? createMusicianDto.instrument,
      },
    });
  }

  async findAll() {
    return this.prisma.musician.findMany({
      include: {
        registrations: { include: { jam: true, jamMusic: { include: { music: true } } } },
      },
    });
  }

  async update(id: string, updateMusicianDto: UpdateMusicianDto, authenticatedMusicianId?: string) {
    const musician = await this.prisma.musician.findUnique({ where: { id } });
    if (!musician) {
      throw new NotFoundException('Musician not found');
    }

    if (authenticatedMusicianId) {
      const isUpdatingOwnProfile = authenticatedMusicianId === id;
      if (!isUpdatingOwnProfile) {
        const authenticatedMusician = await this.prisma.musician.findUnique({
          where: { id: authenticatedMusicianId },
        });
        if (!authenticatedMusician?.isHost) {
          throw new ForbiddenException('You can only update your own profile');
        }
      }
    }

    const data = { ...updateMusicianDto };
    if (data.instrument) {
      data.instrument = normalizeInstrument(data.instrument) ?? data.instrument;
    }

    return this.prisma.musician.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    const musician = await this.prisma.musician.findUnique({ where: { id } });
    if (!musician) {
      throw new NotFoundException('Musician not found');
    }
    return this.prisma.musician.delete({
      where: { id },
    });
  }
}
