import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import {
  initializeApp,
  closeApp,
  testFixtures,
  setupTestData,
  controlRequest as authenticatedControlRequest,
} from './test-helpers';

describe('Live Jam Control HTTP contract (disposable PostgreSQL)', () => {
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
  afterEach(() => testFixtures.cleanup());

  const controlRequest = (action: string, jamId: string, expectedStatus = 200, body?: object) =>
    authenticatedControlRequest(data.hostMusician.token, action, jamId, expectedStatus, body);

  const state = () =>
    request(app.getHttpServer()).get(`/jams/${data.jam.id}/live/state`).expect(200);
  const scheduleDetail = async (scheduleId: string) => {
    const response = await request(app.getHttpServer()).get(`/jams/${data.jam.id}`).expect(200);
    return response.body.schedules.find((song: { id: string }) => song.id === scheduleId);
  };
  const history = () =>
    request(app.getHttpServer())
      .get(`/jams/${data.jam.id}/playback-history`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .expect(200);

  it('supports start, next, pause, resume, previous and stop with public state and history', async () => {
    const id = data.jam.id;
    const first = data.schedules[0].id;
    const second = data.schedules[1].id;
    expect((await controlRequest('start', id)).body).toMatchObject({
      playbackState: 'PLAYING',
      currentScheduleId: first,
    });
    expect((await state()).body.currentSong).toMatchObject({
      id: first,
      status: 'IN_PROGRESS',
      order: 1,
      startedAt: expect.any(String),
    });
    expect((await controlRequest('next', id)).body.currentScheduleId).toBe(second);
    expect((await state()).body.previousSongs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: first,
          status: 'COMPLETED',
          completedAt: expect.any(String),
        }),
      ]),
    );
    expect((await controlRequest('pause', id)).body.playbackState).toBe('PAUSED');
    expect(
      (await request(app.getHttpServer()).get(`/jams/${id}/live/dashboard`).expect(200)).body,
    ).toMatchObject({ playbackState: 'PAUSED', currentSong: { id: data.schedules[1].musicId } });
    expect((await scheduleDetail(second)).pausedAt).toEqual(expect.any(String));
    expect((await controlRequest('resume', id)).body).toMatchObject({
      playbackState: 'PLAYING',
      currentScheduleId: second,
    });
    expect(
      (await request(app.getHttpServer()).get(`/jams/${id}/live/dashboard`).expect(200)).body,
    ).toMatchObject({ playbackState: 'PLAYING', currentSong: { id: data.schedules[1].musicId } });
    expect((await scheduleDetail(second)).pausedAt).toBeNull();
    expect((await controlRequest('previous', id)).body.currentScheduleId).toBe(first);
    expect((await scheduleDetail(first)).completedAt).toBeNull();
    expect((await controlRequest('stop', id)).body).toMatchObject({
      status: 'FINISHED',
      playbackState: 'STOPPED',
      currentScheduleId: null,
    });
    expect((await state()).body.currentSong).toBeNull();
    expect((await history()).body.map((entry: { action: string }) => entry.action)).toEqual(
      expect.arrayContaining([
        'START_JAM',
        'SKIP_SONG',
        'PAUSE_SONG',
        'RESUME_SONG',
        'PREVIOUS_SONG',
        'STOP_JAM',
      ]),
    );
  });

  it('rejects start while paused and resumes the same song', async () => {
    await controlRequest('start', data.jam.id);
    await controlRequest('pause', data.jam.id);
    await controlRequest('start', data.jam.id, 400);
    expect((await controlRequest('resume', data.jam.id)).body.currentScheduleId).toBe(
      data.schedules[0].id,
    );
  });

  it('finishes after advancing beyond the last song', async () => {
    await controlRequest('start', data.jam.id);
    for (let index = 0; index < data.schedules.length; index++) {
      await controlRequest('next', data.jam.id);
    }
    expect((await state()).body).toMatchObject({
      jamStatus: 'FINISHED',
      playbackState: 'STOPPED',
      currentSong: null,
    });
  });

  it('rejects start with no scheduled songs', async () => {
    const jam = await testFixtures.createJam(data.hostMusician.id);
    await controlRequest('start', jam.id, 400);
  });

  it.each(['stop', 'next', 'previous', 'pause', 'resume'])(
    'rejects %s before playback starts',
    async (action) => {
      await controlRequest(action, data.jam.id, 400);
    },
  );

  it('rejects starting an already playing jam', async () => {
    await controlRequest('start', data.jam.id);
    await controlRequest('start', data.jam.id, 400);
  });

  it('serializes concurrent start commands and records only one transition', async () => {
    const start = () =>
      request(app.getHttpServer())
        .post(`/jams/${data.jam.id}/control/start`)
        .set('Authorization', `Bearer ${data.hostMusician.token}`);

    const responses = await Promise.all([start(), start()]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 400]);

    const live = (await state()).body;
    expect(live).toMatchObject({
      playbackState: 'PLAYING',
      currentSong: { id: data.schedules[0].id, status: 'IN_PROGRESS' },
    });
    const detail = await request(app.getHttpServer()).get(`/jams/${data.jam.id}`).expect(200);
    expect(
      detail.body.schedules.filter((song: { status: string }) => song.status === 'IN_PROGRESS'),
    ).toHaveLength(1);
    expect(
      (await history()).body.filter((entry: { action: string }) => entry.action === 'START_JAM'),
    ).toHaveLength(1);
  });

  it('applies concurrent next commands in sequence instead of skipping the same song twice', async () => {
    await controlRequest('start', data.jam.id);
    const next = () =>
      request(app.getHttpServer())
        .post(`/jams/${data.jam.id}/control/next`)
        .set('Authorization', `Bearer ${data.hostMusician.token}`);

    const responses = await Promise.all([next(), next()]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);

    const live = (await state()).body;
    expect(live).toMatchObject({
      playbackState: 'PLAYING',
      currentSong: { id: data.schedules[2].id, status: 'IN_PROGRESS' },
    });
    const detail = await request(app.getHttpServer()).get(`/jams/${data.jam.id}`).expect(200);
    expect(
      detail.body.schedules.filter((song: { status: string }) => song.status === 'IN_PROGRESS'),
    ).toHaveLength(1);
    expect(
      (await history()).body
        .filter((entry: { action: string }) => entry.action === 'SKIP_SONG')
        .map((entry: { scheduleId: string }) => entry.scheduleId)
        .sort(),
    ).toEqual([data.schedules[0].id, data.schedules[1].id].sort());
  });

  it('rejects the second concurrent pause after the first one changes playback state', async () => {
    await controlRequest('start', data.jam.id);
    const pause = () =>
      request(app.getHttpServer())
        .post(`/jams/${data.jam.id}/control/pause`)
        .set('Authorization', `Bearer ${data.hostMusician.token}`);

    const responses = await Promise.all([pause(), pause()]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 400]);
    expect((await state()).body).toMatchObject({
      playbackState: 'PAUSED',
      currentSong: { id: data.schedules[0].id, status: 'IN_PROGRESS' },
    });
    expect(
      (await history()).body.filter((entry: { action: string }) => entry.action === 'PAUSE_SONG'),
    ).toHaveLength(1);
  });

  it('rejects resume when playing', async () => {
    await controlRequest('start', data.jam.id);
    await controlRequest('resume', data.jam.id, 400);
  });

  it('replays the first song when there is no previous completed song', async () => {
    await controlRequest('start', data.jam.id);
    expect((await controlRequest('previous', data.jam.id)).body.currentScheduleId).toBe(
      data.schedules[0].id,
    );
  });

  it.each(['start', 'stop', 'next', 'previous', 'pause', 'resume', 'reorder'])(
    'requires authentication for %s',
    async (action) => {
      await request(app.getHttpServer()).post(`/jams/${data.jam.id}/control/${action}`).expect(401);
    },
  );

  it('forbids playback for a non-host musician', async () => {
    await request(app.getHttpServer())
      .post(`/jams/${data.jam.id}/control/start`)
      .set('Authorization', `Bearer ${data.musician.token}`)
      .expect(403);
  });

  it('returns 404 for a valid but unknown jam ID', async () => {
    await controlRequest('start', randomUUID(), 404);
  });
  it('returns 400 for a malformed jam UUID', async () => {
    await controlRequest('start', 'invalid', 400);
  });

  it('paginates playback history for an authenticated host', async () => {
    await controlRequest('start', data.jam.id);
    await controlRequest('next', data.jam.id);
    await controlRequest('pause', data.jam.id);
    const response = await request(app.getHttpServer())
      .get(`/jams/${data.jam.id}/playback-history?limit=2`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .expect(200);
    expect(response.body).toHaveLength(2);
  });

  it('reorders the queue without changing the current song', async () => {
    await controlRequest('start', data.jam.id);
    const updates = [data.schedules[0], ...data.schedules.slice(1).reverse()].map((s, i) => ({
      scheduleId: s.id,
      order: i + 1,
    }));
    await controlRequest('reorder', data.jam.id, 200, { updates });
    const live = (await state()).body;
    expect(live.currentSong.id).toBe(data.schedules[0].id);
    expect(live.nextSongs.map((s: { id: string }) => s.id)).toEqual(
      data.schedules
        .slice(1)
        .reverse()
        .map((s) => s.id),
    );
    expect((await history()).body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'REORDER_QUEUE',
          metadata: expect.objectContaining({ updates, totalUpdates: 4, contractVersion: 2 }),
        }),
      ]),
    );
  });

  it('honors explicit positions without moving omitted entries', async () => {
    await controlRequest('reorder', data.jam.id, 200, {
      updates: [{ scheduleId: data.schedules[0].id, order: 5 }],
    });
    const songs = (await state()).body.nextSongs;
    expect(songs.map((song: { id: string }) => song.id)).toEqual(
      [1, 2, 3, 0].map((index) => data.schedules[index].id),
    );
    expect(songs.map((song: { order: number }) => song.order)).toEqual([2, 3, 4, 5]);
  });

  it('rejects empty reorder updates', async () => {
    await controlRequest('reorder', data.jam.id, 400, { updates: [] });
  });
  it('rejects duplicate schedule IDs', async () => {
    const scheduleId = data.schedules[0].id;
    await controlRequest('reorder', data.jam.id, 400, {
      updates: [
        { scheduleId, order: 1 },
        { scheduleId, order: 2 },
      ],
    });
  });
  it('rejects foreign schedule IDs and preserves the queue', async () => {
    const other = await testFixtures.createJam(data.hostMusician.id);
    const [schedule] = await testFixtures.createSchedules(other.id, [data.songs[0].id]);
    await controlRequest('reorder', data.jam.id, 400, {
      updates: [{ scheduleId: schedule.id, order: 1 }],
    });
    expect((await state()).body.nextSongs.map((s: { id: string }) => s.id)).toEqual(
      data.schedules.map((s) => s.id),
    );
  });
  it('rejects malformed reorder UUIDs', async () => {
    await controlRequest('reorder', data.jam.id, 400, {
      updates: [{ scheduleId: 'invalid', order: 1 }],
    });
  });
});
