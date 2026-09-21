import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JamManagementMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JamManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanManageJam(jamId: string, musicianId?: string): Promise<void> {
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
      select: { deletedAt: true, hostMusicianId: true, managementMode: true },
    });
    if (!jam || jam.deletedAt) throw new NotFoundException('Jam not found');
    if (
      jam.hostMusicianId === musicianId ||
      jam.managementMode === JamManagementMode.SHARED_HOSTS
    ) {
      return;
    }
    throw new ForbiddenException('Only the event owner can manage this jam');
  }

  async assertIsJamOwner(jamId: string, musicianId?: string): Promise<void> {
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
      select: { deletedAt: true, hostMusicianId: true },
    });
    if (!jam || jam.deletedAt) throw new NotFoundException('Jam not found');
    if (jam.hostMusicianId === musicianId) return;
    throw new ForbiddenException('Only the event owner can change its catalog');
  }

  async assertCanManageSchedule(scheduleId: string, musicianId?: string): Promise<void> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      select: { jamId: true },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    await this.assertCanManageJam(schedule.jamId, musicianId);
  }

  async assertCanManageRegistration(registrationId: string, musicianId?: string): Promise<void> {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      select: { jamId: true },
    });
    if (!registration) throw new NotFoundException('Registration not found');
    await this.assertCanManageJam(registration.jamId, musicianId);
  }
}
