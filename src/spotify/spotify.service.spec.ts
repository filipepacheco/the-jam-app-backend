import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { SpotifyService } from './spotify.service';
import { SpotifyApiClient } from './spotify-api.client';
import { PrismaService } from '../prisma/prisma.service';
import { MusicaService } from '../musica/musica.service';

describe('Spotify import authorization', () => {
  it.each([
    {
      reason: 'the caller does not own the jam',
      owner: 'owner',
      status: 'ACTIVE',
      missing: false,
      error: ForbiddenException,
    },
    {
      reason: 'the jam does not exist',
      owner: 'outsider',
      status: 'ACTIVE',
      missing: true,
      error: NotFoundException,
    },
    {
      reason: 'the jam is inactive',
      owner: 'outsider',
      status: 'INACTIVE',
      missing: false,
      error: BadRequestException,
    },
  ])(
    'leaves the shared catalog unchanged when $reason',
    async ({ owner, status, missing, error }) => {
      const songs: object[] = [];
      const module = await Test.createTestingModule({
        providers: [
          SpotifyService,
          MusicaService,
          {
            provide: PrismaService,
            useValue: {
              music: {
                findMany: async () => songs,
                count: async () => songs.length,
                create: async ({ data }: { data: object }) => {
                  const song = { id: 'song', ...data };
                  songs.push(song);
                  return song;
                },
              },
              jam: {
                findUnique: async () =>
                  missing
                    ? null
                    : {
                        id: 'jam',
                        hostMusicianId: owner,
                        status,
                        schedules: [],
                        jamMusics: [],
                      },
              },
            },
          },
          {
            provide: SpotifyApiClient,
            useValue: {
              isConfigured: true,
              parsePlaylistId: () => 'playlist',
              getClientToken: async () => 'token',
              getPlaylist: async () => ({ name: 'Playlist' }),
              getPlaylistTracks: async () => [
                {
                  name: 'New song',
                  artists: ['Artist'],
                  durationMs: 180000,
                  spotifyUrl: 'https://open.spotify.com/track/example',
                },
              ],
            },
          },
        ],
      }).compile();
      try {
        await expect(
          module
            .get(SpotifyService)
            .importPlaylist({ playlistUrl: 'playlist', jamId: 'jam' }, 'outsider'),
        ).rejects.toBeInstanceOf(error);
        expect((await module.get(MusicaService).findAll()).data).toEqual([]);
      } finally {
        await module.close();
      }
    },
  );
});
