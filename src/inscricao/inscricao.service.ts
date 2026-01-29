import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRegistrationDto } from './dto/create-inscricao.dto';
import { UpdateRegistrationDto } from './dto/update-inscricao.dto';

@Injectable()
export class InscricaoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRegistrationDto: CreateRegistrationDto, musicianId: string) {
    // Get the schedule to validate it exists and get jam info
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: createRegistrationDto.scheduleId },
      include: { jam: true, music: true },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Check if musician is already registered for this schedule with the same instrument
    const existingRegistration = await this.prisma.registration.findFirst({
      where: {
        musicianId,
        jamId: schedule.jamId,
        scheduleId: createRegistrationDto.scheduleId,
        instrument: createRegistrationDto.instrument,
      },
    });

    if (existingRegistration) {
      throw new ConflictException(
        'Musician already registered for this schedule with the same instrument',
      );
    }

    return this.prisma.registration.create({
      data: {
        musicianId,
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

  async remove(id: string, requestingMusicianId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    // Look up requesting musician to check if host
    const requestingMusician = await this.prisma.musician.findUnique({
      where: { id: requestingMusicianId },
    });

    // Allow delete if owner OR host
    const isOwner = registration.musicianId === requestingMusicianId;
    const isHost = requestingMusician?.isHost === true;

    if (!isOwner && !isHost) {
      throw new ForbiddenException('Can only delete your own registrations');
    }

    return this.prisma.registration.delete({
      where: { id },
    });
  }
}
