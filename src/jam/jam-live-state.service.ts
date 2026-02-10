import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JamService } from './jam.service';
import { LiveStateResponseDto } from './dto/live-state-response.dto';
import { LiveDashboardResponseDto, DashboardSongDto } from './dto/live-dashboard-response.dto';

@Injectable()
export class JamLiveStateService {
  constructor(
    private prisma: PrismaService,
    private jamService: JamService,
  ) {}

  async getLiveState(jamId: string): Promise<LiveStateResponseDto> {
    const jam = await this.jamService.findOne(jamId);

    if (!jam) {
      throw new NotFoundException(`Jam with ID ${jamId} not found`);
    }

    const currentSong = jam.schedules?.find((s) => s.status === 'IN_PROGRESS') || null;

    const nextSongs =
      jam.schedules?.filter((s) => s.status === 'SCHEDULED').sort((a, b) => a.order - b.order) ||
      [];

    const previousSongs =
      jam.schedules
        ?.filter((s) => s.status === 'COMPLETED')
        .sort((a, b) => b.order - a.order)
        .reverse() || [];

    const suggestedSongs =
      jam.schedules?.filter((s) => s.status === 'SUGGESTED').sort((a, b) => a.order - b.order) ||
      [];

    return {
      currentSong,
      nextSongs,
      previousSongs,
      suggestedSongs,
      jamStatus: jam.status,
      playbackState: jam.playbackState || 'STOPPED',
      currentSongStartedAt: currentSong?.startedAt || null,
      currentSongPausedAt: currentSong?.pausedAt || null,
      timestamp: Date.now(),
    };
  }

  async getLiveDashboard(jamId: string): Promise<LiveDashboardResponseDto> {
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
    });

    if (!jam) {
      throw new NotFoundException(`Jam with ID ${jamId} not found`);
    }

    const schedules = await this.prisma.schedule.findMany({
      where: { jamId },
      select: {
        id: true,
        order: true,
        status: true,
        music: {
          select: { id: true, title: true, artist: true, duration: true },
        },
        registrations: {
          select: {
            instrument: true,
            musician: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { order: 'asc' },
    });

    const currentSchedule = schedules.find((s) => s.status === 'IN_PROGRESS');
    const currentSong: DashboardSongDto | null = currentSchedule
      ? this.mapScheduleToDashboardSong(currentSchedule)
      : null;

    const nextSchedules = schedules.filter((s) => s.status === 'SCHEDULED').slice(0, 3);
    const nextSongs = nextSchedules.map((schedule) => this.mapScheduleToDashboardSong(schedule));

    return {
      jamId: jam.id,
      jamName: jam.name,
      qrCode: jam.qrCode,
      jamStatus: jam.status,
      currentSong,
      nextSongs,
    };
  }

  private mapScheduleToDashboardSong(schedule: {
    music: { id: string; title: string; artist: string; duration: number | null };
    registrations: Array<{
      instrument: string;
      musician: { id: string; name: string | null };
    }>;
  }): DashboardSongDto {
    return {
      id: schedule.music.id,
      title: schedule.music.title,
      artist: schedule.music.artist,
      duration: schedule.music.duration,
      musicians: schedule.registrations.map((reg) => ({
        id: reg.musician.id,
        name: reg.musician.name,
        instrument: reg.instrument,
      })),
    };
  }
}
