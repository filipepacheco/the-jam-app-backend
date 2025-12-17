import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-escala.dto';
import { UpdateScheduleDto } from './dto/update-escala.dto';
import { WebsocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class EscalaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  async create(createScheduleDto: CreateScheduleDto) {
    // Verify that the music exists
    const music = await this.prisma.music.findUnique({
      where: { id: createScheduleDto.musicId },
    });

    if (!music) {
      throw new BadRequestException('Music not found');
    }

    // Verify that jam exists
    const jam = await this.prisma.jam.findUnique({
      where: { id: createScheduleDto.jamId },
    });

    if (!jam) {
      throw new BadRequestException('Jam not found');
    }

    const schedule = await this.prisma.schedule.create({
      data: {
        jamId: createScheduleDto.jamId,
        musicId: createScheduleDto.musicId,
        order: createScheduleDto.order,
        status: createScheduleDto.status,
      },
      include: {
        music: true,
        jam: true,
      },
    });

    // Emit socket event to all jam users
    this.websocketGateway.emitToJam(createScheduleDto.jamId, 'schedule:created', {
      jamId: createScheduleDto.jamId,
      schedule,
    });

    return schedule;
  }

  async findByJam(jamId: string) {
    return this.prisma.schedule.findMany({
      where: { jamId },
      include: {
        music: true,
        jam: true,
      },
      orderBy: { order: 'asc' },
    });
  }

  // async findByMusico(musicoId: string) {
  //   return this.prisma.schedule.findMany({
  //     where: {
  //       musicianId: musicoId,
  //     },
  //     include: {
  //       musician: true,
  //       music: true,
  //       jam: true,
  //     },
  //     orderBy: { order: 'asc' },
  //   });
  // }

  async update(id: string, updateScheduleDto: UpdateScheduleDto) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: { jam: true },
    });

    if (!schedule) {
      throw new BadRequestException('Schedule not found');
    }

    const updated = await this.prisma.schedule.update({
      where: { id },
      data: updateScheduleDto,
      include: {
        music: true,
        jam: true,
      },
    });

    // Emit socket event - check if status changed
    if (updateScheduleDto.status && updateScheduleDto.status !== schedule.status) {
      this.websocketGateway.emitToJam(schedule.jamId, 'schedule:status-changed', {
        jamId: schedule.jamId,
        scheduleId: id,
        previousStatus: schedule.status,
        newStatus: updateScheduleDto.status,
        timestamp: new Date(),
      });
    }

    // Emit generic update event
    this.websocketGateway.emitToJam(schedule.jamId, 'schedule:updated', {
      jamId: schedule.jamId,
      schedule: updated,
    });

    return updated;
  }

  async remove(id: string) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new BadRequestException('Schedule not found');
    }

    await this.prisma.schedule.delete({
      where: { id },
    });

    // Emit socket event
    this.websocketGateway.emitToJam(schedule.jamId, 'schedule:deleted', {
      jamId: schedule.jamId,
      scheduleId: id,
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
    const fullSchedules = await this.prisma.schedule.findMany({
      where: { id: { in: scheduleIds } },
      include: { music: true, jam: true },
      orderBy: { order: 'asc' },
    });

    // Emit socket event
    this.websocketGateway.emitToJam(jamId, 'schedule:reordered', {
      jamId,
      newOrder: scheduleIds,
      schedules: fullSchedules,
    });

    return updatedSchedules;
  }
}
