import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRegistrationDto } from './dto/create-inscricao.dto';
import { UpdateRegistrationDto } from './dto/update-inscricao.dto';
import { Prisma, RegistrationStatus } from '@prisma/client';
import { normalizeInstrument } from '../common/constants';

@Injectable()
export class InscricaoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRegistrationDto: CreateRegistrationDto, musicianId: string) {
    const instrument = normalizeInstrument(createRegistrationDto.instrument);
    if (!instrument) {
      throw new BadRequestException('Instrument is required');
    }

    // Get the schedule to validate it exists and get jam info
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: createRegistrationDto.scheduleId },
      include: { jam: true, music: true },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }
    if (schedule.jam.deletedAt) {
      throw new NotFoundException('Jam not found');
    }

    // Check if musician is already registered for this schedule with the same instrument
    const existingRegistration = await this.prisma.registration.findFirst({
      where: {
        musicianId,
        jamId: schedule.jamId,
        scheduleId: createRegistrationDto.scheduleId,
        instrument,
      },
    });

    if (existingRegistration) {
      throw new ConflictException(
        'Musician already registered for this schedule with the same instrument',
      );
    }

    try {
      return await this.prisma.registration.create({
        data: {
          musicianId,
          jamId: schedule.jamId,
          scheduleId: createRegistrationDto.scheduleId,
          instrument,
        },
        include: {
          musician: true,
          jam: true,
          schedule: true,
        },
      });
    } catch (error) {
      if (this.isRegistrationIdentityConflict(error)) {
        throw new ConflictException(
          'Musician already registered for this schedule with the same instrument',
        );
      }
      throw error;
    }
  }

  async update(id: string, updateRegistrationDto: UpdateRegistrationDto) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: { jam: true },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }
    if (registration.jam.deletedAt) {
      throw new NotFoundException('Jam not found');
    }

    const updateData: { instrument?: string; status?: RegistrationStatus } = {};

    if (updateRegistrationDto.instrument !== undefined) {
      const instrument = normalizeInstrument(updateRegistrationDto.instrument);
      if (!instrument) {
        throw new BadRequestException('Instrument is required');
      }
      updateData.instrument = instrument;
    }

    if (updateRegistrationDto.status !== undefined) {
      updateData.status = updateRegistrationDto.status;
    }

    try {
      return await this.prisma.registration.update({
        where: { id },
        data: updateData,
        include: {
          musician: true,
          jam: true,
          schedule: true,
        },
      });
    } catch (error) {
      if (this.isRegistrationIdentityConflict(error)) {
        throw new ConflictException(
          'Musician already registered for this schedule with the same instrument',
        );
      }
      throw error;
    }
  }

  async remove(id: string, requestingMusicianId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: { jam: true },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }
    if (registration.jam.deletedAt) {
      throw new NotFoundException('Jam not found');
    }

    // Look up requesting musician to check if host
    const requestingMusician = await this.prisma.musician.findUnique({
      where: { id: requestingMusicianId },
    });

    // Allow to delete if owner OR host
    const isOwner = registration.musicianId === requestingMusicianId;
    const isHost = requestingMusician?.isHost === true;

    if (!isOwner && !isHost) {
      throw new ForbiddenException('Can only delete your own registrations');
    }

    return this.prisma.registration.delete({
      where: { id },
    });
  }

  private isRegistrationIdentityConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
