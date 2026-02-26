import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJamDto } from './dto/create-jam.dto';
import { UpdateJamDto } from './dto/update-jam.dto';
import { generateShortCode, generateSlug } from '../common/utils/slug';
import * as QRCode from 'qrcode';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_CODE_REGEX = /^[A-Z0-9]{6}$/i;

/** Safe musician fields for public responses - excludes email, phone, supabaseUserId */
const MUSICIAN_SAFE_SELECT = {
  id: true,
  name: true,
  instrument: true,
  contact: false,
  level: true,
} as const;

/** Music fields actually used by frontend consumers */
const MUSIC_PUBLIC_SELECT = {
  id: true,
  title: true,
  artist: true,
  genre: true,
  description: true,
  duration: true,
  link: true,
  status: true,
  neededDrums: true,
  neededGuitars: true,
  neededVocals: true,
  neededBass: true,
  neededKeys: true,
} as const;

/** Registration fields actually used by frontend consumers */
const REGISTRATION_PUBLIC_SELECT = {
  id: true,
  instrument: true,
  status: true,
  musicianId: true,
  musician: { select: MUSICIAN_SAFE_SELECT },
} as const;

@Injectable()
export class JamService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async create(createJamDto: CreateJamDto) {
    let hostName = createJamDto.hostName;
    let hostContact = createJamDto.hostContact;

    if (createJamDto.hostMusicianId) {
      const hostMusician = await this.prisma.musician.findUnique({
        where: { id: createJamDto.hostMusicianId },
      });

      if (!hostMusician) {
        throw new BadRequestException('Host musician not found');
      }

      hostName = hostName || hostMusician.name || undefined;
      hostContact = hostContact || hostMusician.contact || undefined;
    }

    const shortCode = await generateShortCode(this.prisma);
    const slug = await this.resolveSlug(createJamDto.slug, createJamDto.name, shortCode);

    const jam = await this.prisma.jam.create({
      data: {
        name: createJamDto.name,
        description: createJamDto.description,
        date: createJamDto.date ? new Date(createJamDto.date) : undefined,
        location: createJamDto.location,
        hostMusicianId: createJamDto.hostMusicianId,
        hostName,
        hostContact,
        status: createJamDto.status,
        shortCode,
        slug,
      },
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const qrCodeUrl = `${frontendUrl}/j/${shortCode}`;
    const qrCode = await QRCode.toDataURL(qrCodeUrl);

    return this.prisma.jam.update({
      where: { id: jam.id },
      data: { qrCode },
    });
  }

  private readonly findAllSelect = {
    id: true,
    name: true,
    description: true,
    date: true,
    qrCode: true,
    slug: true,
    shortCode: true,
    spotifyPlaylistUrl: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    hostName: true,
    playbackState: true,
    currentScheduleId: true,
    _count: {
      select: {
        jamMusics: true,
        registrations: true,
        schedules: true,
      },
    },
  };

  async findAll(skip = 0, take = 20) {
    const where = { deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.jam.findMany({
        where,
        skip,
        take,
        select: this.findAllSelect,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.jam.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        skip,
        take,
        hasMore: skip + take < total,
      },
    };
  }

  /**
   * Find a jam by UUID, slug, or shortCode.
   * Used by public-facing endpoints.
   */
  async findByIdentifier(identifier: string) {
    let jam;

    if (UUID_REGEX.test(identifier)) {
      jam = await this.findOne(identifier);
    } else if (SHORT_CODE_REGEX.test(identifier)) {
      jam = await this.prisma.jam.findFirst({
        where: { shortCode: identifier.toUpperCase(), deletedAt: null },
        select: this.findOneSelect,
      });
    } else {
      // Treat as slug
      jam = await this.prisma.jam.findFirst({
        where: { slug: identifier, deletedAt: null },
        select: this.findOneSelect,
      });
    }

    if (!jam) {
      throw new NotFoundException(`Jam not found: ${identifier}`);
    }

    return {
      ...jam,
      schedules: jam.schedules?.map((schedule) => ({
        ...schedule,
        music: schedule.music,
        registrations: schedule.registrations || [],
      })),
    };
  }

  /**
   * Resolve an identifier (UUID, slug, or shortCode) to a jam ID.
   * Used by control endpoints that need the UUID for internal operations.
   */
  async resolveJamId(identifier: string): Promise<string> {
    let jam;

    if (UUID_REGEX.test(identifier)) {
      jam = await this.prisma.jam.findFirst({
        where: { id: identifier, deletedAt: null },
        select: { id: true },
      });
    } else if (SHORT_CODE_REGEX.test(identifier)) {
      jam = await this.prisma.jam.findFirst({
        where: { shortCode: identifier.toUpperCase(), deletedAt: null },
        select: { id: true },
      });
    } else {
      jam = await this.prisma.jam.findFirst({
        where: { slug: identifier, deletedAt: null },
        select: { id: true },
      });
    }

    if (!jam) {
      throw new NotFoundException(`Jam not found: ${identifier}`);
    }
    return jam.id;
  }

  /**
   * Resolve slug: use custom slug if provided, otherwise auto-generate.
   * Validates uniqueness for custom slugs.
   * @param customSlug
   * @param name
   * @param shortCode
   * @param excludeJamId - Exclude this jam ID from uniqueness check (for updates).
   */
  private async resolveSlug(
    customSlug: string | undefined,
    name: string,
    shortCode: string,
    excludeJamId?: string,
  ): Promise<string> {
    if (!customSlug) {
      return generateSlug(name, shortCode);
    }

    // Check uniqueness of custom slug (only among non-deleted jams)
    const existing = await this.prisma.jam.findFirst({
      where: { slug: customSlug, deletedAt: null },
      select: { id: true },
    });

    if (existing && existing.id !== excludeJamId) {
      throw new BadRequestException(`Slug "${customSlug}" is already taken`);
    }

    return customSlug;
  }

  private readonly findOneSelect = {
    // Jam scalar fields
    id: true,
    name: true,
    description: true,
    date: true,
    location: true,
    slug: true,
    shortCode: true,
    spotifyPlaylistUrl: true,
    status: true,
    hostName: true,
    hostContact: false,
    hostMusicianId: false,
    createdAt: true,
    updatedAt: false,

    schedules: {
      select: {
        id: true,
        jamId: true,
        musicId: true,
        order: true,
        status: true,
        startedAt: true,
        pausedAt: true,
        completedAt: true,
        music: { select: MUSIC_PUBLIC_SELECT },
        registrations: { select: REGISTRATION_PUBLIC_SELECT },
      },
      orderBy: { order: 'asc' as const },
    },

    _count: {
      select: {
        jamMusics: true,
        registrations: true,
        schedules: true,
      },
    },
  };

  async findOne(id: string) {
    const jam = await this.prisma.jam.findFirst({
      where: { id, deletedAt: null },
      select: this.findOneSelect,
    });

    if (!jam) return null;

    const schedulesWithDetails = jam.schedules.map((schedule) => {
      return {
        ...schedule,
        music: schedule.music,
        registrations: schedule.registrations || [],
      };
    });

    return {
      ...jam,
      schedules: schedulesWithDetails,
    };
  }

  async update(id: string, updateJamDto: UpdateJamDto, musicianId?: string, isHost?: boolean) {
    const jam = await this.prisma.jam.findFirst({ where: { id, deletedAt: null } });
    if (!jam) {
      throw new NotFoundException('Jam not found');
    }
    if (musicianId && !isHost && jam.hostMusicianId && jam.hostMusicianId !== musicianId) {
      throw new ForbiddenException('Only the jam host can update this jam');
    }

    // Handle slug: custom slug takes priority, otherwise regenerate on name change
    const data: Record<string, unknown> = { ...updateJamDto };
    if (updateJamDto.slug !== undefined) {
      data.slug = await this.resolveSlug(
        updateJamDto.slug,
        updateJamDto.name || jam.name,
        jam.shortCode || '',
        id,
      );
    } else if (updateJamDto.name && updateJamDto.name !== jam.name && jam.shortCode) {
      data.slug = generateSlug(updateJamDto.name, jam.shortCode);
    }

    return this.prisma.jam.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, musicianId?: string) {
    const jam = await this.prisma.jam.findFirst({ where: { id, deletedAt: null } });
    if (!jam) {
      throw new NotFoundException('Jam not found');
    }
    if (musicianId && jam.hostMusicianId && jam.hostMusicianId !== musicianId) {
      throw new ForbiddenException('Only the jam host can delete this jam');
    }
    return this.prisma.jam.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        slug: null,
        shortCode: null,
      },
    });
  }
}
