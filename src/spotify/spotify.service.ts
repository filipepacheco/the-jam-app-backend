import {
  Injectable,
  BadRequestException,
  NotFoundException,
  HttpException,
  ServiceUnavailableException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SpotifyApiClient } from './spotify-api.client';
import { ImportPlaylistDto } from './dto/import-playlist.dto';
import { ImportResultDto } from './dto/import-result.dto';
import { ExportPlaylistDto } from './dto/export-playlist.dto';
import { ExportResultDto } from './dto/export-result.dto';
import { GetTrackDto } from './dto/get-track.dto';
import { TrackMetadataDto } from './dto/track-metadata.dto';
import { MusicStatus } from '@prisma/client';
import { SpotifyApiError } from './types/spotify.types';

@Injectable()
export class SpotifyService {
  private readonly logger = new Logger(SpotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly spotifyApi: SpotifyApiClient,
  ) {}

  async importPlaylist(dto: ImportPlaylistDto, hostMusicianId: string): Promise<ImportResultDto> {
    if (!this.spotifyApi.isConfigured) {
      throw new ServiceUnavailableException('Spotify integration is not configured');
    }

    const playlistId = this.spotifyApi.parsePlaylistId(dto.playlistUrl);
    if (!playlistId) {
      throw new BadRequestException('Invalid Spotify playlist URL or URI');
    }

    let token: string;
    try {
      token = await this.spotifyApi.getClientToken();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Spotify client token authentication failed: ${message}`);
      throw new ServiceUnavailableException('Failed to authenticate with Spotify');
    }

    let playlistMeta: { name: string; description: string | null };
    let tracks: Awaited<ReturnType<SpotifyApiClient['getPlaylistTracks']>>;

    try {
      [playlistMeta, tracks] = await Promise.all([
        this.spotifyApi.getPlaylist(playlistId, token),
        this.spotifyApi.getPlaylistTracks(playlistId, token),
      ]);
    } catch (err: unknown) {
      this.handleSpotifyApiError(err, 'playlist');
    }

    const errors: string[] = [];
    let importedTracks = 0;
    let reusedTracks = 0;
    let skippedTracks = 0;

    // Batch deduplication: find existing music by Spotify link
    const allLinks = tracks.map((t) => t.spotifyUrl);
    const existingMusic = await this.prisma.music.findMany({
      where: { link: { in: allLinks } },
    });
    const linkToMusic = new Map(existingMusic.map((m) => [m.link, m]));

    // Create missing music records
    const musicIds: string[] = [];
    for (const track of tracks) {
      const existing = linkToMusic.get(track.spotifyUrl);
      if (existing) {
        musicIds.push(existing.id);
        reusedTracks++;
        continue;
      }

      try {
        const created = await this.prisma.music.create({
          data: {
            title: track.name,
            artist: track.artists.join(', '),
            duration: Math.round(track.durationMs / 1000),
            link: track.spotifyUrl,
            status: MusicStatus.APPROVED,
            // Default band setup: 1 vocal, 2 guitars, 1 bass, 1 drums
            neededVocals: 1,
            neededGuitars: 2,
            neededBass: 1,
            neededDrums: 1,
            neededKeys: 0,
          },
        });
        musicIds.push(created.id);
        importedTracks++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to create music for track ${track.name}: ${message}`);
        errors.push(`Failed to import "${track.name}" by ${track.artists.join(', ')}`);
        skippedTracks++;
      }
    }

    let jam;
    let startingOrder = 0;
    let existingJamMusicIds = new Set<string>();
    const isExistingJam = !!dto.jamId;

    if (dto.jamId) {
      // Import to existing jam
      jam = await this.prisma.jam.findUnique({
        where: { id: dto.jamId },
        include: {
          schedules: { orderBy: { order: 'desc' }, take: 1 },
          jamMusics: { select: { musicId: true } },
        },
      });

      if (!jam) {
        throw new NotFoundException('Jam not found');
      }

      // Verify user is the host
      if (jam.hostMusicianId !== hostMusicianId) {
        throw new ForbiddenException('You must be the jam host to import tracks');
      }

      // Only allow importing to ACTIVE or LIVE jams
      if (jam.status !== 'ACTIVE' && jam.status !== 'LIVE') {
        throw new BadRequestException('Cannot import to a jam that is not active or live');
      }

      // Get starting order for new tracks (append after existing)
      startingOrder = jam.schedules[0]?.order || 0;

      // Get existing music IDs to avoid duplicates within the jam
      existingJamMusicIds = new Set(jam.jamMusics.map((jm) => jm.musicId));
    } else {
      // Create new jam
      jam = await this.prisma.jam.create({
        data: {
          name: dto.name || playlistMeta.name,
          description: dto.description || playlistMeta.description || undefined,
          date: dto.date ? new Date(dto.date) : undefined,
          location: dto.location,
          hostMusicianId,
        },
      });
    }

    // Track how many tracks were actually added vs skipped as duplicates
    let addedTracks = 0;
    let duplicateTracks = 0;

    // Create JamMusic links and Schedule entries
    for (let i = 0; i < musicIds.length; i++) {
      const musicId = musicIds[i];

      // Skip if music already exists in this jam (duplicate detection)
      if (existingJamMusicIds.has(musicId)) {
        duplicateTracks++;
        continue;
      }

      try {
        await this.prisma.jamMusic.create({
          data: { jamId: jam.id, musicId },
        });

        // Calculate order: for existing jams, append after current tracks
        const order = startingOrder + addedTracks + 1;

        await this.prisma.schedule.create({
          data: {
            jamId: jam.id,
            musicId,
            order,
            status: 'SCHEDULED',
          },
        });

        addedTracks++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to add track to jam: ${message}`);
        errors.push(`Failed to add track to jam`);
        skippedTracks++;
      }
    }

    // Fetch the full jam with relations
    const fullJam = await this.prisma.jam.findUnique({
      where: { id: jam.id },
      include: {
        jamMusics: { include: { music: true } },
        schedules: { include: { music: true }, orderBy: { order: 'asc' } },
      },
    });

    return {
      jam: fullJam,
      importedTracks,
      reusedTracks,
      skippedTracks,
      addedTracks,
      duplicateTracks,
      isExistingJam,
      ...(errors.length > 0 ? { errors } : {}),
    };
  }

  async exportPlaylist(dto: ExportPlaylistDto): Promise<ExportResultDto> {
    const jam = await this.prisma.jam.findUnique({
      where: { id: dto.jamId },
      include: {
        schedules: {
          include: { music: true },
          orderBy: { order: 'asc' },
        },
        jamMusics: {
          include: { music: true },
        },
      },
    });

    if (!jam) {
      throw new NotFoundException('Jam not found');
    }

    // Prefer schedules for ordering, fall back to jamMusics
    const musicList =
      jam.schedules.length > 0
        ? jam.schedules.map((s) => s.music)
        : jam.jamMusics.map((jm) => jm.music);

    const trackUris: string[] = [];
    const errors: string[] = [];
    let skippedTracks = 0;

    for (const music of musicList) {
      const uri = music.link ? this.spotifyApi.extractTrackUri(music.link) : null;
      if (uri) {
        trackUris.push(uri);
      } else {
        skippedTracks++;
        errors.push(`No valid Spotify link for "${music.title}" by ${music.artist}`);
      }
    }

    if (trackUris.length === 0) {
      throw new BadRequestException('No tracks with valid Spotify links found in this jam');
    }

    let userId: string;
    let playlist: { id: string; externalUrl: string };

    try {
      userId = await this.spotifyApi.getCurrentUserId(dto.spotifyAccessToken);

      playlist = await this.spotifyApi.createPlaylist(
        userId,
        dto.playlistName || jam.name,
        dto.playlistDescription,
        dto.public ?? false,
        dto.spotifyAccessToken,
      );

      await this.spotifyApi.addTracksToPlaylist(playlist.id, trackUris, dto.spotifyAccessToken);
    } catch (err: unknown) {
      this.handleSpotifyApiError(err, 'export');
    }

    return {
      spotifyPlaylistId: playlist.id,
      spotifyPlaylistUrl: playlist.externalUrl,
      totalTracks: trackUris.length,
      skippedTracks,
      ...(errors.length > 0 ? { errors } : {}),
    };
  }

  async getTrackMetadata(dto: GetTrackDto): Promise<TrackMetadataDto> {
    if (!this.spotifyApi.isConfigured) {
      throw new ServiceUnavailableException('Spotify integration is not configured');
    }

    const trackId = this.spotifyApi.parseTrackId(dto.trackUrl);
    if (!trackId) {
      throw new BadRequestException('Invalid Spotify track URL or URI');
    }

    let token: string;
    try {
      token = await this.spotifyApi.getClientToken();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Spotify client token authentication failed: ${message}`);
      throw new ServiceUnavailableException('Failed to authenticate with Spotify');
    }

    try {
      const track = await this.spotifyApi.getTrack(trackId, token);

      return {
        id: track.id,
        title: track.name,
        artist: track.artists.join(', '),
        durationMs: track.durationMs,
        spotifyUrl: track.spotifyUrl,
        albumName: track.albumName,
        albumImageUrl: track.albumImageUrl,
      };
    } catch (err: unknown) {
      this.handleSpotifyApiError(err, 'track');
    }
  }

  private handleSpotifyApiError(err: unknown, context: string): never {
    const apiErr = err as SpotifyApiError;
    const status = apiErr?.status;

    if (status === 401) {
      throw new HttpException('Invalid or expired Spotify token', 401);
    }
    if (status === 403) {
      throw new HttpException(`Spotify ${context} is private or inaccessible`, 403);
    }
    if (status === 404) {
      throw new NotFoundException(`Spotify ${context} not found`);
    }
    if (status === 429) {
      const retryAfter = apiErr.retryAfter;
      throw new HttpException({ message: 'Spotify rate limit exceeded', retryAfter }, 429);
    }

    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`Spotify API error during ${context}: ${message}`);
    throw new HttpException('Failed to communicate with Spotify', 502);
  }
}
