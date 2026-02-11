import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMusicDto } from './dto/create-musica.dto';
import { UpdateMusicDto } from './dto/update-musica.dto';

@Injectable()
export class MusicaService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createMusicDto: CreateMusicDto) {
    return this.prisma.music.create({
      data: createMusicDto,
    });
  }

  async findAll() {
    return this.prisma.music.findMany({
      include: {
        jamMusics: { include: { jam: true } },
      },
      orderBy: {
        title: 'asc',
      },
    });
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

  async linkToJam(musicaId: string, jamId: string) {
    return this.prisma.$transaction(async (tx) => {
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
