import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRegistrationDto } from './dto/create-inscricao.dto';
import { UpdateRegistrationDto } from './dto/update-inscricao.dto';
import { RegistrationStatus } from '@prisma/client';

@Injectable()
export class InscricaoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRegistrationDto: CreateRegistrationDto) {
    // Get the schedule to validate it exists and get jam info
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: createRegistrationDto.scheduleId },
      include: { jam: true, music: true },
    });

    if (!schedule) {
      throw new ConflictException('Schedule not found');
    }

    // Check if musician is already registered for this schedule's music
    const existingRegistration = await this.prisma.registration.findFirst({
      where: {
        musicianId: createRegistrationDto.musicianId,
        jamId: schedule.jamId,
        scheduleId: createRegistrationDto.scheduleId,
      },
    });

    if (existingRegistration) {
      throw new ConflictException('Musician already registered for this schedule');
    }

    return this.prisma.registration.create({
      data: {
        musicianId: createRegistrationDto.musicianId,
        jamId: schedule.jamId,
        scheduleId: createRegistrationDto.scheduleId,
        instrument: createRegistrationDto.instrument,
      },
      include: {
        musician: true,
        jam: true,
        schedule: true,
      },
    });
  }

  async findByJam(jamId: string) {
    return this.prisma.registration.findMany({
      where: { jamId },
      include: {
        musician: true,
        jamMusic: { include: { music: true } },
      },
    });
  }

  // async findByMusico(musicoId: string) {
  //   return this.prisma.registration.findMany({
  //     where: { musicianId: musicoId },
  //     include: {
  //       jam: true,
  //       jamMusic: { include: { music: true } },
  //     },
  //   });
  // }

  async update(id: string, updateRegistrationDto: UpdateRegistrationDto) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    const updateData: any = {};

    if (updateRegistrationDto.instrument !== undefined) {
      updateData.instrument = updateRegistrationDto.instrument;
    }

    if (updateRegistrationDto.status !== undefined) {
      updateData.status = updateRegistrationDto.status;
    }

    return this.prisma.registration.update({
      where: { id },
      data: updateData,
      include: {
        musician: true,
        jam: true,
        schedule: true,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.registration.delete({
      where: { id },
    });
  }

  async approve(id: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    return this.prisma.registration.update({
      where: { id },
      data: {
        status: RegistrationStatus.APPROVED,
      },
      include: {
        musician: true,
        jam: true,
        schedule: true,
      },
    });
  }

  async reject(id: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    return this.prisma.registration.update({
      where: { id },
      data: {
        status: RegistrationStatus.REJECTED,
      },
      include: {
        musician: true,
        jam: true,
        schedule: true,
      },
    });
  }
}
