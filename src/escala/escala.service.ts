import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, ScheduleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-escala.dto';
import { UpdateScheduleDto } from './dto/update-escala.dto';
import { lockJamQueue } from './queue-lock';

const MAX_QUEUE_ORDER = 2_147_483_647;

@Injectable()
export class EscalaService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createScheduleDto: CreateScheduleDto, isHost = false) {
    if (
      !isHost &&
      createScheduleDto.status &&
      createScheduleDto.status !== ScheduleStatus.SUGGESTED
    ) {
      throw new ForbiddenException('Only hosts can approve suggested songs');
    }
    if (
      createScheduleDto.status === ScheduleStatus.IN_PROGRESS ||
      createScheduleDto.status === ScheduleStatus.COMPLETED
    ) {
      throw new BadRequestException('Playback-owned schedule statuses cannot be created directly');
    }
    // Verify that the music exists
    const music = await this.prisma.music.findUnique({
      where: { id: createScheduleDto.musicId },
    });

    if (!music) {
      throw new NotFoundException('Music not found');
    }

    // Verify that jam exists
    const jam = await this.prisma.jam.findUnique({
      where: { id: createScheduleDto.jamId, deletedAt: null },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    // The parent-row lock serializes allocation with imports and queue reorders.
    return this.prisma.$transaction(async (tx) => {
      await lockJamQueue(tx, createScheduleDto.jamId);
      const lastSchedule = await tx.schedule.findFirst({
        where: { jamId: createScheduleDto.jamId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      const lastOrder = Math.max(lastSchedule?.order ?? 0, 0);
      if (lastOrder >= MAX_QUEUE_ORDER) {
        throw new BadRequestException('Queue order limit reached');
      }

      return tx.schedule.create({
        data: {
          jamId: createScheduleDto.jamId,
          musicId: createScheduleDto.musicId,
          order: lastOrder + 1,
          status: createScheduleDto.status,
        },
        include: {
          music: true,
          jam: true,
        },
      });
    });
  }

  async update(id: string, updateScheduleDto: UpdateScheduleDto) {
    return this.prisma.$transaction(async (tx) => {
      const schedule = await this.lockSchedule(tx, id);
      if (updateScheduleDto.jamId && updateScheduleDto.jamId !== schedule.jamId) {
        const targetJam = await tx.jam.findUnique({
          where: { id: updateScheduleDto.jamId, deletedAt: null },
          select: { id: true },
        });
        if (!targetJam) {
          throw new NotFoundException('Jam not found');
        }
        throw new BadRequestException('Songs cannot be moved between jams');
      }

      if (
        updateScheduleDto.status === ScheduleStatus.IN_PROGRESS ||
        updateScheduleDto.status === ScheduleStatus.COMPLETED
      ) {
        throw new BadRequestException('Playback controls own in-progress and completed statuses');
      }
      if (
        updateScheduleDto.status !== undefined &&
        (schedule.jam.currentScheduleId === id ||
          schedule.status === ScheduleStatus.IN_PROGRESS ||
          schedule.status === ScheduleStatus.COMPLETED ||
          schedule.startedAt !== null ||
          schedule.completedAt !== null)
      ) {
        throw new BadRequestException('Only unplayed songs can change queue status');
      }

      if (
        updateScheduleDto.musicId !== undefined &&
        updateScheduleDto.musicId !== schedule.musicId &&
        (schedule._count.registrations > 0 ||
          schedule._count.playbackHistory > 0 ||
          schedule.jam.currentScheduleId === id ||
          schedule.status === ScheduleStatus.IN_PROGRESS ||
          schedule.status === ScheduleStatus.COMPLETED ||
          schedule.startedAt !== null ||
          schedule.completedAt !== null)
      ) {
        throw new BadRequestException('Music cannot be replaced after registration or playback');
      }

      if (updateScheduleDto.order !== undefined) {
        throw new BadRequestException('Use queue reorder to change positions');
      }

      return tx.schedule.update({
        where: { id },
        data: { musicId: updateScheduleDto.musicId, status: updateScheduleDto.status },
        include: {
          music: true,
          jam: true,
        },
      });
    });
  }

  async remove(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const schedule = await this.lockSchedule(tx, id);
      if (
        schedule.jam.currentScheduleId === id ||
        schedule.status === ScheduleStatus.IN_PROGRESS ||
        schedule.status === ScheduleStatus.COMPLETED
      ) {
        throw new BadRequestException('Current or completed songs cannot be removed');
      }

      if (schedule._count.registrations > 0 || schedule._count.playbackHistory > 0) {
        return tx.schedule.update({
          where: { id },
          data: { status: ScheduleStatus.CANCELED },
        });
      }

      return tx.schedule.delete({
        where: { id },
      });
    });
  }

  private async lockSchedule(tx: Prisma.TransactionClient, id: string) {
    const identity = await tx.schedule.findUnique({ where: { id }, select: { jamId: true } });
    if (!identity) throw new NotFoundException('Schedule not found');
    await lockJamQueue(tx, identity.jamId);
    // Block new registration foreign keys while deciding whether deletion is safe.
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "escalas" WHERE "id" = ${id} FOR UPDATE
    `);
    if (rows.length === 0) throw new NotFoundException('Schedule not found');
    return tx.schedule.findUniqueOrThrow({
      where: { id },
      include: { jam: true, _count: { select: { registrations: true, playbackHistory: true } } },
    });
  }
}
