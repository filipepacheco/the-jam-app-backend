import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PlaybackState, ScheduleStatus } from '@prisma/client';
import { JamPlaybackService } from './jam-playback.service';
import { PrismaService } from '../prisma/prisma.service';

async function playbackFixture() {
  const jam = {
    id: 'jam',
    status: 'ACTIVE',
    playbackState: PlaybackState.STOPPED,
    currentScheduleId: null as string | null,
  };
  const songs = [1, 2].map((order) => ({
    id: `song-${order}`,
    order,
    status: ScheduleStatus.SCHEDULED,
  }));
  const db = {
    jam: {
      findUnique: async () => ({ ...jam }),
      update: async ({ data }: { data: Partial<typeof jam> }) => ({ ...Object.assign(jam, data) }),
    },
    schedule: {
      findFirst: async ({ where }: { where: { id?: string; status?: ScheduleStatus } }) =>
        where.id
          ? songs.find((s) => s.id === where.id)
          : songs.find((s) => s.status === where.status),
      findUnique: async ({ where }: { where: { id: string } }) =>
        songs.find((s) => s.id === where.id),
      update: async ({ where, data }: { where: { id: string }; data: object }) =>
        Object.assign(
          songs.find((s) => s.id === where.id),
          data,
        ),
    },
    playbackHistory: { create: async () => ({}) },
    $queryRaw: async () => [{ id: jam.id }],
  };
  const module = await Test.createTestingModule({
    providers: [
      JamPlaybackService,
      {
        provide: PrismaService,
        useValue: {
          ...db,
          $transaction: async (operation: (tx: typeof db) => Promise<unknown>) => operation(db),
        },
      },
    ],
  }).compile();
  return { playback: module.get(JamPlaybackService), close: () => module.close() };
}

describe('Jam playback transitions', () => {
  it('requires resume to continue a paused song instead of starting another one', async () => {
    const { playback, close } = await playbackFixture();
    try {
      await playback.startJam('jam');
      await playback.pauseSong('jam');
      await expect(playback.startJam('jam')).rejects.toBeInstanceOf(BadRequestException);
      expect(await playback.resumeSong('jam')).toMatchObject({
        playbackState: 'PLAYING',
        currentScheduleId: 'song-1',
      });
    } finally {
      await close();
    }
  });
  it('finishes the jam when advancing past its last song', async () => {
    const { playback, close } = await playbackFixture();
    try {
      await playback.startJam('jam');
      await playback.nextSong('jam');
      expect(await playback.nextSong('jam')).toMatchObject({
        status: 'FINISHED',
        playbackState: 'STOPPED',
        currentScheduleId: null,
      });
    } finally {
      await close();
    }
  });
});
