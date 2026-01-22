import { Injectable } from '@nestjs/common';
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
    return this.prisma.music.update({
      where: { id },
      data: updateMusicDto,
    });
  }

  async remove(id: string) {
    return this.prisma.music.delete({
      where: { id },
    });
  }

  async linkToJam(musicaId: string, jamId: string) {
    // Check if the link already exists
    const existingLink = await this.prisma.jamMusic.findFirst({
      where: {
        jamId,
        musicId: musicaId,
      },
    });

    if (existingLink) {
      return existingLink;
    }

    // Create the link
    return this.prisma.jamMusic.create({
      data: {
        jamId,
        musicId: musicaId,
      },
      include: {
        jam: true,
        music: true,
      },
    });
  }
}
