import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LiveStateResponseDto, LiveStateSongDto } from './dto/live-state-response.dto';
import { LiveDashboardResponseDto, DashboardSongDto } from './dto/live-dashboard-response.dto';

@Injectable()
export class JamLiveStateService {
  constructor(private prisma: PrismaService) {}

  async getLiveState(jamId: string): Promise<LiveStateResponseDto> {
    const jam = await this.prisma.jam.findUnique({
      where: { id: jamId },
      select: { id: true, status: true, playbackState: true },
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
        startedAt: true,
        completedAt: true,
        music: {
          select: { title: true, artist: true, duration: true, link: true },
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

    const songs: LiveStateSongDto[] = schedules.map((s) => ({
      id: s.id,
      order: s.order,
      status: s.status,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      music: {
        title: s.music.title,
        artist: s.music.artist,
        duration: s.music.duration,
        link: s.music.link,
      },
      musicians: s.registrations.map((reg) => ({
        id: reg.musician.id,
        name: reg.musician.name,
        instrument: reg.instrument,
      })),
    }));

    const currentSong = songs.find((s) => s.status === 'IN_PROGRESS') || null;
    const nextSongs = songs.filter((s) => s.status === 'SCHEDULED');
    const previousSongs = songs.filter((s) => s.status === 'COMPLETED');
    const suggestedSongs = songs.filter((s) => s.status === 'SUGGESTED');

    return {
      currentSong,
      nextSongs,
      previousSongs,
      suggestedSongs,
      jamStatus: jam.status,
      playbackState: jam.playbackState || 'STOPPED',
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
          select: { id: true, title: true, artist: true, duration: true, link: true },
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
      slug: jam.slug,
      shortCode: jam.shortCode,
      jamStatus: jam.status,
      currentSong,
      nextSongs,
    };
  }

  private mapScheduleToDashboardSong(schedule: {
    music: { id: string; title: string; artist: string; duration: number | null; link: string | null };
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
      link: schedule.music.link,
      musicians: schedule.registrations.map((reg) => ({
        id: reg.musician.id,
        name: reg.musician.name,
        instrument: reg.instrument,
      })),
    };
  }
}
