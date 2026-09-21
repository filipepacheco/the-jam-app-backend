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
import { MusicStatus, Prisma } from '@prisma/client';
import { SpotifyApiError } from './types/spotify.types';
import { generateShortCode, generateSlug } from '../common/utils/slug';
import { lockJamQueue } from '../escala/queue-lock';

const MAX_QUEUE_ORDER = 2_147_483_647;
const SPOTIFY_IMPORT_JAM_INCLUDE = {
  jamMusics: { include: { music: true } },
  schedules: { include: { music: true }, orderBy: { order: 'asc' as const } },
} satisfies Prisma.JamInclude;

type SpotifyImportJam = Prisma.JamGetPayload<{ include: typeof SPOTIFY_IMPORT_JAM_INCLUDE }>;

@Injectable()
export class SpotifyService {
  private readonly logger = new Logger(SpotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly spotifyApi: SpotifyApiClient,
  ) {}

  async importPlaylist(
    dto: ImportPlaylistDto,
    hostMusicianId: string,
    idempotencyKey?: string,
  ): Promise<ImportResultDto> {
    if (!this.spotifyApi.isConfigured) {
      throw new ServiceUnavailableException('Spotify integration is not configured');
    }

    const playlistId = this.spotifyApi.parsePlaylistId(dto.playlistUrl);
    if (!playlistId) {
      throw new BadRequestException('Invalid Spotify playlist URL or URI');
    }

    const isExistingJam = !!dto.jamId;
    const spotifyImportKey = idempotencyKey?.trim();

    if (
      !dto.jamId &&
      (!spotifyImportKey || spotifyImportKey.length < 8 || spotifyImportKey.length > 128)
    ) {
      throw new BadRequestException(
        'Idempotency-Key with 8 to 128 characters is required when creating a jam',
      );
    }

    if (!dto.jamId) {
      const replay = await this.prisma.jam.findUnique({
        where: {
          hostMusicianId_spotifyImportKey: {
            hostMusicianId,
            spotifyImportKey: spotifyImportKey!,
          },
        },
        include: SPOTIFY_IMPORT_JAM_INCLUDE,
      });
      if (replay) {
        return this.replayedNewJamImport(replay);
      }
    }

    if (dto.jamId) {
      const jam = await this.prisma.jam.findUnique({
        where: { id: dto.jamId, deletedAt: null },
        select: { hostMusicianId: true, status: true },
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

    return this.prisma.$transaction(
      async (tx) => {
        let jam;
        let existingJamMusicIds: Set<string>;

        if (dto.jamId) {
          await lockJamQueue(tx, dto.jamId);
          jam = await tx.jam.findUnique({
            where: { id: dto.jamId, deletedAt: null },
            include: { jamMusics: { select: { musicId: true } } },
          });
          if (!jam) {
            throw new NotFoundException('Jam not found');
          }
          if (jam.hostMusicianId !== hostMusicianId) {
            throw new ForbiddenException('You must be the jam host to import tracks');
          }
          if (jam.status !== 'ACTIVE' && jam.status !== 'LIVE') {
            throw new BadRequestException('Cannot import to a jam that is not active or live');
          }
          existingJamMusicIds = new Set(jam.jamMusics.map((jamMusic) => jamMusic.musicId));
        } else {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`spotify-import:${hostMusicianId}:${spotifyImportKey}`}, 0))::text AS locked`;
          const replay = await tx.jam.findUnique({
            where: {
              hostMusicianId_spotifyImportKey: {
                hostMusicianId,
                spotifyImportKey: spotifyImportKey!,
              },
            },
            include: SPOTIFY_IMPORT_JAM_INCLUDE,
          });
          if (replay) {
            return this.replayedNewJamImport(replay);
          }
          const shortCode = await generateShortCode(
            async (code) =>
              !!(await tx.jam.findUnique({
                where: { shortCode: code },
                select: { id: true },
              })),
          );
          const jamName = dto.name || playlistMeta.name;
          jam = await tx.jam.create({
            data: {
              name: jamName,
              description: dto.description || playlistMeta.description || undefined,
              date: dto.date ? new Date(dto.date) : undefined,
              location: dto.location,
              slug: dto.slug || generateSlug(jamName, shortCode),
              shortCode,
              hostMusicianId,
              spotifyPlaylistUrl: dto.playlistUrl,
              spotifyImportKey,
            },
            include: { jamMusics: { select: { musicId: true } } },
          });
          existingJamMusicIds = new Set();
        }

        const uniqueTracks = new Map(tracks.map((track) => [track.spotifyUrl, track]));
        const links = [...uniqueTracks.keys()];
        const existingMusic = await tx.music.findMany({ where: { link: { in: links } } });
        const existingLinks = new Set(existingMusic.map((music) => music.link));
        const missingTracks = [...uniqueTracks.values()].filter(
          (track) => !existingLinks.has(track.spotifyUrl),
        );
        const importedTracks = missingTracks.length
          ? (
              await tx.music.createMany({
                data: missingTracks.map((track) => ({
                  title: track.name,
                  artist: track.artists.join(', '),
                  duration: Math.round(track.durationMs / 1000),
                  link: track.spotifyUrl,
                  status: MusicStatus.APPROVED,
                  neededVocals: 1,
                  neededGuitars: 2,
                  neededBass: 1,
                  neededDrums: 1,
                  neededKeys: 0,
                })),
                skipDuplicates: true,
              })
            ).count
          : 0;
        const allMusic = await tx.music.findMany({ where: { link: { in: links } } });
        const linkToMusic = new Map(allMusic.map((music) => [music.link, music]));
        const musicIds = tracks.map((track) => linkToMusic.get(track.spotifyUrl)!.id);
        const reusedTracks = tracks.length - importedTracks;

        const lastSchedule = await tx.schedule.findFirst({
          where: { jamId: jam.id },
          orderBy: { order: 'desc' },
          select: { order: true },
        });
        let lastOrder = Math.max(lastSchedule?.order ?? 0, 0);
        let addedTracks = 0;
        let duplicateTracks = 0;

        for (const musicId of musicIds) {
          if (existingJamMusicIds.has(musicId)) {
            duplicateTracks++;
            continue;
          }
          if (lastOrder >= MAX_QUEUE_ORDER) {
            throw new BadRequestException('Queue order limit reached');
          }
          lastOrder++;
          await tx.jamMusic.create({ data: { jamId: jam.id, musicId } });
          await tx.schedule.create({
            data: { jamId: jam.id, musicId, order: lastOrder, status: 'SCHEDULED' },
          });
          existingJamMusicIds.add(musicId);
          addedTracks++;
        }

        const fullJam = await tx.jam.findUnique({
          where: { id: jam.id },
          include: SPOTIFY_IMPORT_JAM_INCLUDE,
        });

        return {
          jam: fullJam,
          importedTracks,
          reusedTracks,
          skippedTracks: 0,
          addedTracks,
          duplicateTracks,
          isExistingJam,
        };
      },
      { timeout: 60_000 },
    );
  }

  private replayedNewJamImport(jam: SpotifyImportJam): ImportResultDto {
    return {
      jam,
      importedTracks: 0,
      reusedTracks: 0,
      skippedTracks: 0,
      addedTracks: 0,
      duplicateTracks: jam.jamMusics.length,
      isExistingJam: false,
    };
  }

  async exportPlaylist(dto: ExportPlaylistDto): Promise<ExportResultDto> {
    const jam = await this.prisma.jam.findUnique({
      where: { id: dto.jamId, deletedAt: null },
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
    } catch (err: unknown) {
      this.handleSpotifyApiError(err, 'export');
    }

    try {
      await this.spotifyApi.addTracksToPlaylist(playlist.id, trackUris, dto.spotifyAccessToken);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Spotify playlist population failed: ${message}`);
      throw new HttpException(
        {
          message: 'Spotify playlist was created but tracks could not be added',
          error: 'Bad Gateway',
          details: {
            partialPlaylistId: playlist.id,
            partialPlaylistUrl: playlist.externalUrl,
          },
        },
        502,
      );
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
