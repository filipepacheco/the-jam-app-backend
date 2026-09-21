import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { SpotifyApiClient } from '../src/spotify/spotify-api.client';
import {
  closeApp,
  controlRequest,
  getPrismaService,
  initializeApp,
  setupTestData,
  testFixtures,
} from './test-helpers';

describe('Jam queue ordering HTTP contract (disposable PostgreSQL)', () => {
  let app: INestApplication;
  let data: Awaited<ReturnType<typeof setupTestData>>;

  beforeAll(async () => {
    app = await initializeApp();
  });
  afterAll(closeApp);
  beforeEach(async () => {
    await testFixtures.cleanup();
    data = await setupTestData();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await testFixtures.cleanup();
  });

  it('moves supplied songs to the front and preserves the omitted songs relative order', async () => {
    await controlRequest(data.hostMusician.token, 'reorder', data.jam.id, 200, {
      updates: [
        { scheduleId: data.schedules[2].id, order: 2 },
        { scheduleId: data.schedules[0].id, order: 1 },
      ],
    });

    const state = await request(app.getHttpServer())
      .get(`/jams/${data.jam.id}/live/state`)
      .expect(200);

    expect(state.body.nextSongs.map((song: { id: string }) => song.id)).toEqual([
      data.schedules[0].id,
      data.schedules[2].id,
      data.schedules[1].id,
      data.schedules[3].id,
    ]);
    expect(state.body.nextSongs.map((song: { order: number }) => song.order)).toEqual([1, 2, 3, 4]);
  });

  it('allocates distinct contiguous positions for concurrent schedule appends', async () => {
    const [firstMusic, secondMusic] = await Promise.all([
      testFixtures.createMusic(),
      testFixtures.createMusic(),
    ]);
    const create = (musicId: string) =>
      request(app.getHttpServer())
        .post('/escalas')
        .set('Authorization', `Bearer ${data.hostMusician.token}`)
        .send({ jamId: data.jam.id, musicId, order: 999, status: 'SCHEDULED' })
        .expect(201);

    await Promise.all([create(firstMusic.id), create(secondMusic.id)]);

    const state = await request(app.getHttpServer())
      .get(`/jams/${data.jam.id}/live/state`)
      .expect(200);
    expect(state.body.nextSongs.map((song: { order: number }) => song.order)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it('allocates after the highest occupied position when the queue has a gap', async () => {
    const jam = await testFixtures.createJam(data.hostMusician.id);
    await getPrismaService().schedule.create({
      data: { jamId: jam.id, musicId: data.songs[0].id, order: 7, status: 'SCHEDULED' },
    });

    const response = await request(app.getHttpServer())
      .post('/escalas')
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ jamId: jam.id, musicId: data.songs[1].id, order: 1, status: 'SCHEDULED' })
      .expect(201);

    expect(response.body.order).toBe(8);
  });

  it('rejects an append at the PostgreSQL queue-order limit', async () => {
    const jam = await testFixtures.createJam(data.hostMusician.id);
    await getPrismaService().schedule.create({
      data: { jamId: jam.id, musicId: data.songs[0].id, order: 2_147_483_647, status: 'SCHEDULED' },
    });

    await request(app.getHttpServer())
      .post('/escalas')
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ jamId: jam.id, musicId: data.songs[1].id, order: 1, status: 'SCHEDULED' })
      .expect(400);
  });

  it('keeps a concurrent append when a partial reorder renumbers the queue', async () => {
    const music = await testFixtures.createMusic();
    const reorder = controlRequest(data.hostMusician.token, 'reorder', data.jam.id, 200, {
      updates: [
        { scheduleId: data.schedules[2].id, order: 2 },
        { scheduleId: data.schedules[0].id, order: 1 },
      ],
    });
    const append = request(app.getHttpServer())
      .post('/escalas')
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ jamId: data.jam.id, musicId: music.id, order: 1, status: 'SCHEDULED' })
      .expect(201);

    await Promise.all([reorder, append]);

    const state = await request(app.getHttpServer())
      .get(`/jams/${data.jam.id}/live/state`)
      .expect(200);
    expect(state.body.nextSongs.map((song: { id: string }) => song.id)).toEqual([
      data.schedules[0].id,
      data.schedules[2].id,
      data.schedules[1].id,
      data.schedules[3].id,
      expect.any(String),
    ]);
    expect(state.body.nextSongs.map((song: { order: number }) => song.order)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('keeps a normal append when a Spotify import appends to the same jam', async () => {
    const spotifyApi = app.get(SpotifyApiClient);
    jest.spyOn(spotifyApi, 'isConfigured', 'get').mockReturnValue(true);
    jest.spyOn(spotifyApi, 'parsePlaylistId').mockReturnValue('playlist');
    jest.spyOn(spotifyApi, 'getClientToken').mockResolvedValue('token');
    jest
      .spyOn(spotifyApi, 'getPlaylist')
      .mockResolvedValue({ name: 'Playlist', description: null });
    jest.spyOn(spotifyApi, 'getPlaylistTracks').mockResolvedValue([
      {
        id: 'spotify-track',
        name: 'Spotify song',
        artists: ['Spotify artist'],
        durationMs: 180000,
        spotifyUrl: 'https://open.spotify.com/track/spotifytrack',
      },
    ]);
    const music = await testFixtures.createMusic();

    await Promise.all([
      request(app.getHttpServer())
        .post('/spotify/import')
        .set('Authorization', `Bearer ${data.hostMusician.token}`)
        .send({
          jamId: data.jam.id,
          playlistUrl: 'https://open.spotify.com/playlist/playlist',
        })
        .expect(201),
      request(app.getHttpServer())
        .post('/escalas')
        .set('Authorization', `Bearer ${data.hostMusician.token}`)
        .send({ jamId: data.jam.id, musicId: music.id, order: 1, status: 'SCHEDULED' })
        .expect(201),
    ]);

    const state = await request(app.getHttpServer())
      .get(`/jams/${data.jam.id}/live/state`)
      .expect(200);
    expect(state.body.nextSongs.map((song: { order: number }) => song.order)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });
  it('renumbers a legacy queue at both PostgreSQL integer limits', async () => {
    const jam = await testFixtures.createJam(data.hostMusician.id);
    const first = await getPrismaService().schedule.create({
      data: {
        jamId: jam.id,
        musicId: data.songs[0].id,
        order: -2_147_483_648,
        status: 'SCHEDULED',
      },
    });
    const last = await getPrismaService().schedule.create({
      data: { jamId: jam.id, musicId: data.songs[1].id, order: 2_147_483_647, status: 'SCHEDULED' },
    });
    await controlRequest(data.hostMusician.token, 'reorder', jam.id, 200, {
      updates: [{ scheduleId: last.id, order: 1 }],
    });
    const response = await request(app.getHttpServer()).get(`/jams/${jam.id}`).expect(200);
    expect(
      response.body.schedules.map((slot: { id: string; order: number }) => ({
        id: slot.id,
        order: slot.order,
      })),
    ).toEqual([
      { id: last.id, order: 1 },
      { id: first.id, order: 2 },
    ]);
  });
});
