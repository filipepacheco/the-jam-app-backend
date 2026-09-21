import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMusicDto } from './dto/create-musica.dto';
import { UpdateMusicDto } from './dto/update-musica.dto';
import { UpdateJamMusicDto } from './dto/update-jam-music.dto';
import { MusicStatus } from '@prisma/client';

const PUBLIC_MUSIC_SELECT = {
  id: true,
  title: true,
  artist: true,
  genre: true,
  duration: true,
  description: true,
  link: true,
  info: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  neededDrums: true,
  neededGuitars: true,
  neededVocals: true,
  neededBass: true,
  neededKeys: true,
  jamMusics: {
    where: { jam: { deletedAt: null } },
    select: {
      id: true,
      jamId: true,
      musicId: true,
      notes: true,
      jam: {
        select: {
          id: true,
          name: true,
          description: true,
          date: true,
          slug: true,
          shortCode: true,
          status: true,
          location: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class MusicaService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createMusicDto: CreateMusicDto) {
    return this.prisma.music.create({
      data: createMusicDto,
    });
  }

  async findAll(skip = 0, take = 50, status?: string) {
    const where = status ? { status: status as MusicStatus } : {};
    const [data, total] = await Promise.all([
      this.prisma.music.findMany({
        where,
        skip,
        take,
        select: PUBLIC_MUSIC_SELECT,
        orderBy: {
          title: 'asc',
        },
      }),
      this.prisma.music.count({ where }),
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

  async update(id: string, updateMusicDto: UpdateMusicDto) {
    const music = await this.prisma.music.findUnique({ where: { id } });
    if (!music) {
      throw new NotFoundException('Music not found');
    }
    return this.prisma.music.update({
      where: { id },
      data: updateMusicDto,
    });
  }

  async remove(id: string) {
    const music = await this.prisma.music.findUnique({ where: { id } });
    if (!music) {
      throw new NotFoundException('Music not found');
    }
    return this.prisma.music.delete({
      where: { id },
    });
  }

  async updateJamMusic(jamMusicId: string, jamId: string, dto: UpdateJamMusicDto) {
    const jamMusic = await this.prisma.jamMusic.findFirst({
      where: { id: jamMusicId, jamId, jam: { deletedAt: null } },
    });
    if (!jamMusic) {
      throw new NotFoundException('Song not found in this jam');
    }

    return this.prisma.jamMusic.update({
      where: { id: jamMusicId },
      data: { notes: dto.notes },
    });
  }

  async linkToJam(musicaId: string, jamId: string) {
    return this.prisma.$transaction(async (tx) => {
      const jam = await tx.jam.findUnique({ where: { id: jamId, deletedAt: null } });
      if (!jam) {
        throw new NotFoundException('Jam not found');
      }

      const existingLink = await tx.jamMusic.findFirst({
        where: {
          jamId,
          musicId: musicaId,
        },
      });

      if (existingLink) {
        return existingLink;
      }

      return tx.jamMusic.create({
        data: {
          jamId,
          musicId: musicaId,
        },
        include: {
          jam: true,
          music: true,
        },
      });
    });
  }
}
