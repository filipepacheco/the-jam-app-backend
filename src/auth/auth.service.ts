import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {Musician} from '@prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
  ) {}

  /**
   * Get musician profile by ID
   * Validates JWT claims
   */
  async getMusicianProfile(musicianId: string): Promise<Musician> {
    if (!musicianId || typeof musicianId !== 'string') {
      throw new BadRequestException('Invalid musician ID');
    }

    const musician = await this.prisma.musician.findUnique({
      where: { id: musicianId },
    });

    if (!musician) {
      this.logger.warn(`[PROFILE_NOT_FOUND] musicianId: ${musicianId}`);
      throw new NotFoundException('Musician not found');
    }

    return musician;
  }

  /**
   * Update musician profile
   * Allows musicians to fill in registration info after login
   */
  async updateProfile(musicianId: string, updateData: UpdateProfileDto): Promise<Musician> {
    if (!musicianId || typeof musicianId !== 'string') {
      throw new BadRequestException('Invalid musician ID');
    }

    // Verify musician exists
    const musician = await this.prisma.musician.findUnique({
      where: { id: musicianId },
    });

    if (!musician) {
      throw new BadRequestException('Musician not found');
    }

    // Update only provided fields
    const updatePayload = {};
    if (updateData.name !== undefined) {
      updatePayload['name'] = updateData.name;
    }
    if (updateData.instrument !== undefined) {
      updatePayload['instrument'] = updateData.instrument;
    }
    if (updateData.level !== undefined) {
      updatePayload['level'] = updateData.level;
    }
    if (updateData.contact !== undefined) {
      updatePayload['contact'] = updateData.contact;
    }
    if (updateData.phone !== undefined) {
      updatePayload['phone'] = updateData.phone;
    }
    if (updateData.isHost !== undefined) {
      updatePayload['isHost'] = updateData.isHost;
    }

    const updatedMusician = await this.prisma.musician.update({
      where: { id: musicianId },
      data: updatePayload,
    });

    this.logger.log(`[PROFILE_UPDATED] musicianId: ${musicianId}`);
    return updatedMusician;
  }

  /**
   * Check if musician has completed registration
   * Registration is complete when: instrument, level, and contact are all set
   */
  isRegistrationComplete(musician: Musician): boolean {
    return !!(musician.instrument && musician.level && musician.phone);
  }

}
