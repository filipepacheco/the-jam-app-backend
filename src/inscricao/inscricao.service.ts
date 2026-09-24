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
import { JamStatus, Prisma, RegistrationStatus, ScheduleStatus } from '@prisma/client';
import { normalizeInstrument } from '../common/constants';
import { JamManagementService } from '../jam/jam-management.service';

@Injectable()
export class InscricaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jamManagementService: JamManagementService,
  ) {}

  async create(
    createRegistrationDto: CreateRegistrationDto,
    requestingMusicianId: string,
    requestingMusicianIsHost = false,
  ) {
    const musicianId = createRegistrationDto.musicianId ?? requestingMusicianId;
    if (musicianId !== requestingMusicianId && !requestingMusicianIsHost) {
      throw new ForbiddenException('Registrations must be created by the applying musician');
    }
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
    const canManage =
      requestingMusicianIsHost &&
      this.jamManagementService.canHostManageJam(schedule.jam, requestingMusicianId);
    if (musicianId !== requestingMusicianId && !canManage) {
      throw new ForbiddenException('Only the event owner can manage this jam');
    }
    this.assertCanCreateForSchedule(schedule.jam.status, schedule.status, canManage);

    // Check if musician is already registered for this schedule with the same instrument
    const existingRegistration = await this.prisma.registration.findFirst({
      where: {
        musicianId,
        jamId: schedule.jamId,
        scheduleId: createRegistrationDto.scheduleId,
        instrument,
      },
    });

    const initialStatus = schedule.jam.autoApproveRegistrations
      ? RegistrationStatus.APPROVED
      : RegistrationStatus.PENDING;

    if (existingRegistration?.status === RegistrationStatus.WITHDRAWN) {
      // A withdrawn row keeps its unique musician/slot/instrument identity.
      // Reapplying restores that same row under the jam's current approval rule.
      const restored = await this.prisma.registration.updateMany({
        where: { id: existingRegistration.id, status: RegistrationStatus.WITHDRAWN },
        data: { status: initialStatus },
      });
      if (restored.count === 0) {
        throw new ConflictException(
          'Musician already registered for this schedule with the same instrument',
        );
      }
      return this.prisma.registration.findUniqueOrThrow({
        where: { id: existingRegistration.id },
        include: { musician: true, jam: true, schedule: true },
      });
    }

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
          status: initialStatus,
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

  async update(id: string, updateRegistrationDto: UpdateRegistrationDto, canManage = false) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: { jam: true, schedule: true },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }
    if (registration.jam.deletedAt) {
      throw new NotFoundException('Jam not found');
    }
    this.assertCanModifyRegistration(
      registration.jam.status,
      registration.schedule?.status,
      canManage,
    );

    const updateData: { instrument?: string; status?: RegistrationStatus } = {};

    if (updateRegistrationDto.instrument !== undefined) {
      if (registration.status === RegistrationStatus.WITHDRAWN) {
        throw new BadRequestException('Cannot change a withdrawn registration');
      }
      if (registration.status === RegistrationStatus.APPROVED) {
        throw new BadRequestException(
          'Cannot change the instrument after a registration is approved',
        );
      }
      const instrument = normalizeInstrument(updateRegistrationDto.instrument);
      if (!instrument) {
        throw new BadRequestException('Instrument is required');
      }
      updateData.instrument = instrument;
    }

    if (updateRegistrationDto.status !== undefined) {
      this.assertAllowedHostStatusTransition(registration.status, updateRegistrationDto.status);
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

  async remove(id: string, requestingMusicianId: string, requestingMusicianIsHost: boolean) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: { jam: true, schedule: true },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }
    if (registration.jam.deletedAt) {
      throw new NotFoundException('Jam not found');
    }
    const canManage =
      requestingMusicianIsHost &&
      this.jamManagementService.canHostManageJam(registration.jam, requestingMusicianId);

    const isOwner = registration.musicianId === requestingMusicianId;
    if (!isOwner) {
      if (!requestingMusicianIsHost) {
        throw new ForbiddenException('Can only withdraw your own registrations');
      }

      if (!canManage) {
        throw new ForbiddenException('Only the event owner can manage this jam');
      }
    }
    this.assertCanModifyRegistration(
      registration.jam.status,
      registration.schedule?.status,
      canManage,
    );

    if (registration.status === RegistrationStatus.WITHDRAWN) {
      throw new BadRequestException('Registration has already been withdrawn');
    }

    return this.prisma.registration.update({
      where: { id },
      data: { status: RegistrationStatus.WITHDRAWN },
      include: {
        musician: true,
        jam: true,
        schedule: true,
      },
    });
  }

  private assertCanCreateForSchedule(
    jamStatus: JamStatus,
    scheduleStatus: ScheduleStatus,
    canManage = false,
  ) {
    if (jamStatus !== JamStatus.ACTIVE && jamStatus !== JamStatus.LIVE) {
      throw new BadRequestException('Registrations are only available for active events');
    }

    if (
      !canManage &&
      (scheduleStatus === ScheduleStatus.CANCELED ||
        scheduleStatus === ScheduleStatus.IN_PROGRESS ||
        scheduleStatus === ScheduleStatus.COMPLETED)
    ) {
      throw new BadRequestException('Registrations are closed for this scheduled song');
    }
  }

  private assertCanModifyRegistration(
    jamStatus: JamStatus,
    scheduleStatus?: ScheduleStatus | null,
    canManage = false,
  ) {
    this.assertCanCreateForSchedule(
      jamStatus,
      scheduleStatus ?? ScheduleStatus.CANCELED,
      canManage,
    );
  }

  private assertAllowedHostStatusTransition(
    currentStatus: RegistrationStatus,
    nextStatus: RegistrationStatus,
  ) {
    const allowedTransitions: Record<RegistrationStatus, RegistrationStatus[]> = {
      [RegistrationStatus.PENDING]: [RegistrationStatus.APPROVED, RegistrationStatus.REJECTED],
      [RegistrationStatus.APPROVED]: [RegistrationStatus.REJECTED],
      [RegistrationStatus.REJECTED]: [RegistrationStatus.PENDING],
      [RegistrationStatus.WITHDRAWN]: [RegistrationStatus.APPROVED],
    };

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      throw new BadRequestException(
        `Cannot transition a ${currentStatus.toLowerCase()} registration to ${nextStatus.toLowerCase()}`,
      );
    }
  }

  private isRegistrationIdentityConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
