import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMusicianDto } from './dto/create-musico.dto';
import { UpdateMusicianDto } from './dto/update-musico.dto';

@Injectable()
export class MusicoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createMusicianDto: CreateMusicianDto) {
    return this.prisma.musician.create({
      data: createMusicianDto,
    });
  }

  async findAll() {
    return this.prisma.musician.findMany({
      include: {
        registrations: { include: { jam: true, jamMusic: { include: { music: true } } } },
      },
    });
  }

  async update(id: string, updateMusicianDto: UpdateMusicianDto) {
    return this.prisma.musician.update({
      where: { id },
      data: updateMusicianDto,
    });
  }

  async remove(id: string) {
    return this.prisma.musician.delete({
      where: { id },
    });
  }
}
