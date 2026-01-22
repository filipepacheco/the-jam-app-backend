import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {CreateScheduleDto} from './dto/create-escala.dto';
import {UpdateScheduleDto} from './dto/update-escala.dto';

@Injectable()
export class EscalaService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(createScheduleDto: CreateScheduleDto) {
    // Verify that the music exists
    const music = await this.prisma.music.findUnique({
      where: { id: createScheduleDto.musicId },
    });

    if (!music) {
      throw new NotFoundException('Music not found');
    }

    // Verify that jam exists
    const jam = await this.prisma.jam.findUnique({
      where: { id: createScheduleDto.jamId },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    const order = await this.prisma.schedule.count({
      where: { jamId: createScheduleDto.jamId },
    });

    return this.prisma.schedule.create({
      data: {
        jamId: createScheduleDto.jamId,
        musicId: createScheduleDto.musicId,
        order: order + 1,
        status: createScheduleDto.status,
      },
      include: {
        music: true,
        jam: true,
      },
    });
  }

  async update(id: string, updateScheduleDto: UpdateScheduleDto) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: { jam: true },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return this.prisma.schedule.update({
      where: {id},
      data: updateScheduleDto,
      include: {
        music: true,
        jam: true,
      },
    });
  }

  async remove(id: string) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return this.prisma.schedule.delete({
      where: { id },
    });
  }

  async reorderSchedule(jamId: string, scheduleIds: string[]) {
    // Validate that all schedules belong to the specified jam
    const schedules = await this.prisma.schedule.findMany({
      where: {
        id: { in: scheduleIds },
        jamId: jamId,
      },
    });

    if (schedules.length !== scheduleIds.length) {
      throw new BadRequestException('One or more schedules do not belong to the specified jam');
    }

    const updates = scheduleIds.map((id, index) =>
      this.prisma.schedule.update({
        where: { id },
        data: { order: index + 1 },
      })
    );

    const updatedSchedules = await Promise.all(updates);

    // Fetch full schedule details with relations
    await this.prisma.schedule.findMany({
      where: { id: { in: scheduleIds } },
      include: { music: true, jam: true },
      orderBy: { order: 'asc' },
    });
    return updatedSchedules;
  }
}
