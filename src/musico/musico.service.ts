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

  async findAll(skip = 0, take = 50) {
    return this.prisma.musician.findMany({
      skip,
      take,
      select: {
        id: true,
        name: true,
        instrument: true,
        level: true,
        isHost: true,
        contact: true,
        phone: true,
        createdAt: true,
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

    // Explicit field allowlist to prevent mass assignment of sensitive fields
    // (isHost, supabaseUserId, email, createdAt, deletedAt are NOT allowed)
    const data: Record<string, unknown> = {};
    if (updateMusicianDto.name !== undefined) data.name = updateMusicianDto.name;
    if (updateMusicianDto.instrument !== undefined) {
      data.instrument = normalizeInstrument(updateMusicianDto.instrument) ?? updateMusicianDto.instrument;
    }
    if (updateMusicianDto.level !== undefined) data.level = updateMusicianDto.level;
    if (updateMusicianDto.phone !== undefined) data.phone = updateMusicianDto.phone;
    if (updateMusicianDto.contact !== undefined) data.contact = updateMusicianDto.contact;

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
