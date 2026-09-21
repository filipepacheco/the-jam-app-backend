import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { SpotifyApiClient } from '../src/spotify/spotify-api.client';
import { closeApp, getPrismaService, initializeApp, testFixtures } from './test-helpers';

describe('Spotify import atomicity (disposable PostgreSQL)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await initializeApp();
  });

  afterAll(closeApp);

  beforeEach(async () => {
    await testFixtures.cleanup();
  });

  afterEach(() => jest.restoreAllMocks());

  it('rolls back the whole import on a queue failure and lets the request be retried', async () => {
    const host = await testFixtures.createMusician({ isHost: true });
    const jam = await testFixtures.createJam(host.id);
    const sentinelMusic = await testFixtures.createMusic({ title: 'Existing queue song' });
    const sentinel = await getPrismaService().schedule.create({
      data: {
        jamId: jam.id,
        musicId: sentinelMusic.id,
        order: 2_147_483_646,
        status: 'SCHEDULED',
      },
    });
    const spotifyApi = app.get(SpotifyApiClient);
    jest.spyOn(spotifyApi, 'isConfigured', 'get').mockReturnValue(true);
    jest.spyOn(spotifyApi, 'parsePlaylistId').mockReturnValue('playlist');
    jest.spyOn(spotifyApi, 'getClientToken').mockResolvedValue('token');
    jest
      .spyOn(spotifyApi, 'getPlaylist')
      .mockResolvedValue({ name: 'Atomic playlist', description: null });
    jest.spyOn(spotifyApi, 'getPlaylistTracks').mockResolvedValue([
      {
        id: 'atomic-one',
        name: 'Atomic one',
        artists: ['Test artist'],
        durationMs: 180_000,
        spotifyUrl: 'https://open.spotify.com/track/atomic-one',
      },
      {
        id: 'atomic-two',
        name: 'Atomic two',
        artists: ['Test artist'],
        durationMs: 190_000,
        spotifyUrl: 'https://open.spotify.com/track/atomic-two',
      },
    ]);
    const importPlaylist = (expectedStatus: number) =>
      request(app.getHttpServer())
        .post('/spotify/import')
        .set('Authorization', `Bearer ${host.token}`)
        .send({
          jamId: jam.id,
          playlistUrl: 'https://open.spotify.com/playlist/playlist',
        })
        .expect(expectedStatus);

    await importPlaylist(400);

    const afterFailure = await request(app.getHttpServer()).get(`/jams/${jam.id}`).expect(200);
    expect(afterFailure.body.schedules.map((slot: { id: string }) => slot.id)).toEqual([
      sentinel.id,
    ]);
    expect(afterFailure.body.jamMusics).toEqual([]);
    const catalogAfterFailure = await request(app.getHttpServer()).get('/musicas').expect(200);
    expect(
      catalogAfterFailure.body.data.filter((music: { link?: string }) =>
        music.link?.includes('/track/atomic-'),
      ),
    ).toEqual([]);

    await getPrismaService().schedule.update({ where: { id: sentinel.id }, data: { order: 1 } });

    const retry = await importPlaylist(201);
    expect(retry.body).toMatchObject({ addedTracks: 2, importedTracks: 2, skippedTracks: 0 });
    expect(retry.body.jam.schedules.map((slot: { order: number }) => slot.order)).toEqual([
      1, 2, 3,
    ]);
  });

  it('serializes duplicate imports into one jam without duplicate links or queue entries', async () => {
    const host = await testFixtures.createMusician({ isHost: true });
    const jam = await testFixtures.createJam(host.id);
    const spotifyApi = app.get(SpotifyApiClient);
    jest.spyOn(spotifyApi, 'isConfigured', 'get').mockReturnValue(true);
    jest.spyOn(spotifyApi, 'parsePlaylistId').mockReturnValue('playlist');
    jest.spyOn(spotifyApi, 'getClientToken').mockResolvedValue('token');
    jest
      .spyOn(spotifyApi, 'getPlaylist')
      .mockResolvedValue({ name: 'Concurrent playlist', description: null });
    jest.spyOn(spotifyApi, 'getPlaylistTracks').mockResolvedValue([
      {
        id: 'concurrent-track',
        name: 'Concurrent track',
        artists: ['Test artist'],
        durationMs: 180_000,
        spotifyUrl: 'https://open.spotify.com/track/concurrent-track',
      },
    ]);
    const importPlaylist = () =>
      request(app.getHttpServer())
        .post('/spotify/import')
        .set('Authorization', `Bearer ${host.token}`)
        .send({
          jamId: jam.id,
          playlistUrl: 'https://open.spotify.com/playlist/playlist',
        });

    const responses = await Promise.all([importPlaylist(), importPlaylist()]);

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(
      responses
        .map((response) => ({
          addedTracks: response.body.addedTracks,
          duplicateTracks: response.body.duplicateTracks,
        }))
        .sort((left, right) => right.addedTracks - left.addedTracks),
    ).toEqual([
      { addedTracks: 1, duplicateTracks: 0 },
      { addedTracks: 0, duplicateTracks: 1 },
    ]);
    const detail = await request(app.getHttpServer()).get(`/jams/${jam.id}`).expect(200);
    expect(detail.body.schedules).toHaveLength(1);
    expect(detail.body.jamMusics).toHaveLength(1);
  });

  it('replays concurrent new-jam imports with the same idempotency key', async () => {
    const host = await testFixtures.createMusician({ isHost: true });
    const spotifyApi = app.get(SpotifyApiClient);
    jest.spyOn(spotifyApi, 'isConfigured', 'get').mockReturnValue(true);
    jest.spyOn(spotifyApi, 'parsePlaylistId').mockReturnValue('playlist');
    jest.spyOn(spotifyApi, 'getClientToken').mockResolvedValue('token');
    jest
      .spyOn(spotifyApi, 'getPlaylist')
      .mockResolvedValue({ name: 'Idempotent playlist', description: null });
    jest.spyOn(spotifyApi, 'getPlaylistTracks').mockResolvedValue([
      {
        id: 'idempotent-track',
        name: 'Idempotent track',
        artists: ['Test artist'],
        durationMs: 180_000,
        spotifyUrl: 'https://open.spotify.com/track/idempotent-track',
      },
    ]);
    const importPlaylist = () =>
      request(app.getHttpServer())
        .post('/spotify/import')
        .set('Authorization', `Bearer ${host.token}`)
        .set('Idempotency-Key', 'same-new-jam-import')
        .send({ playlistUrl: 'https://open.spotify.com/playlist/playlist' });

    const responses = await Promise.all([importPlaylist(), importPlaylist()]);

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(responses[0].body.jam.id).toBe(responses[1].body.jam.id);
    const jams = await request(app.getHttpServer()).get('/jams').expect(200);
    expect(
      jams.body.data.filter((jam: { name: string }) => jam.name === 'Idempotent playlist'),
    ).toHaveLength(1);
  });

  it('shares one catalog track across concurrent imports into different new jams', async () => {
    const host = await testFixtures.createMusician({ isHost: true });
    const spotifyApi = app.get(SpotifyApiClient);
    jest.spyOn(spotifyApi, 'isConfigured', 'get').mockReturnValue(true);
    jest.spyOn(spotifyApi, 'parsePlaylistId').mockReturnValue('playlist');
    jest.spyOn(spotifyApi, 'getClientToken').mockResolvedValue('token');
    jest
      .spyOn(spotifyApi, 'getPlaylist')
      .mockResolvedValue({ name: 'Shared track', description: null });
    jest.spyOn(spotifyApi, 'getPlaylistTracks').mockResolvedValue([
      {
        id: 'shared-catalog-track',
        name: 'Shared catalog track',
        artists: ['Test artist'],
        durationMs: 180_000,
        spotifyUrl: 'https://open.spotify.com/track/shared-catalog-track',
      },
    ]);
    const importPlaylist = (key: string, name: string) =>
      request(app.getHttpServer())
        .post('/spotify/import')
        .set('Authorization', `Bearer ${host.token}`)
        .set('Idempotency-Key', key)
        .send({ playlistUrl: 'https://open.spotify.com/playlist/playlist', name });

    const responses = await Promise.all([
      importPlaylist('new-jam-import-one', 'First imported jam'),
      importPlaylist('new-jam-import-two', 'Second imported jam'),
    ]);

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(responses[0].body.jam.id).not.toBe(responses[1].body.jam.id);
    const catalog = await request(app.getHttpServer()).get('/musicas').expect(200);
    expect(
      catalog.body.data.filter(
        (music: { link?: string }) =>
          music.link === 'https://open.spotify.com/track/shared-catalog-track',
      ),
    ).toHaveLength(1);
  });
});
