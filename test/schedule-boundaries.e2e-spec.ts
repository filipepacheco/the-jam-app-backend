import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  closeApp,
  controlRequest,
  initializeApp,
  setupTestData,
  testFixtures,
} from './test-helpers';

describe('Schedule mutation boundaries (disposable PostgreSQL)', () => {
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

  const remove = (id: string) =>
    request(app.getHttpServer())
      .delete(`/escalas/${id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`);
  const detail = () => request(app.getHttpServer()).get(`/jams/${data.jam.id}`).expect(200);
  const history = () =>
    request(app.getHttpServer())
      .get(`/jams/${data.jam.id}/playback-history`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .expect(200);

  it('rejects deleting the current song and preserves playback and history', async () => {
    await controlRequest(data.hostMusician.token, 'start', data.jam.id);
    const before = (await history()).body;
    await remove(data.schedules[0].id).expect(400);
    const state = await request(app.getHttpServer())
      .get(`/jams/${data.jam.id}/live/state`)
      .expect(200);
    expect(state.body).toMatchObject({
      playbackState: 'PLAYING',
      currentSong: { id: data.schedules[0].id, status: 'IN_PROGRESS' },
    });
    expect((await history()).body).toEqual(before);
  });
  it('cancels a registered unplayed slot without losing its application or history', async () => {
    const registration = await request(app.getHttpServer())
      .post('/inscricoes')
      .set('Authorization', `Bearer ${data.musician.token}`)
      .send({ scheduleId: data.schedules[0].id, instrument: 'guitar' })
      .expect(201);
    const before = (await detail()).body.schedules[0].registrations;
    expect(before).toHaveLength(1);
    await controlRequest(data.hostMusician.token, 'reorder', data.jam.id, 200, {
      updates: [{ scheduleId: data.schedules[0].id, order: 1 }],
    });
    const previousHistory = (await history()).body;
    await remove(data.schedules[0].id).expect(200);
    const slot = (await detail()).body.schedules.find(
      (song: { id: string }) => song.id === data.schedules[0].id,
    );
    expect(slot).toMatchObject({ status: 'CANCELED', registrations: before });
    expect((await history()).body).toEqual(previousHistory);
    expect(registration.body.id).toBeDefined();
  });

  it('rejects moving a slot to another jam without changing either queue', async () => {
    const otherJam = await testFixtures.createJam(data.hostMusician.id);
    const before = (await detail()).body.schedules;
    await request(app.getHttpServer())
      .patch(`/escalas/${data.schedules[0].id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ jamId: otherJam.id })
      .expect(400);
    expect((await detail()).body.schedules).toEqual(before);
    const other = await request(app.getHttpServer()).get(`/jams/${otherJam.id}`).expect(200);
    expect(other.body.schedules).toEqual([]);
  });

  it.each(['IN_PROGRESS', 'COMPLETED'])('rejects PATCH into playback-owned %s', async (status) => {
    const before = (await detail()).body.schedules;
    await request(app.getHttpServer())
      .patch(`/escalas/${data.schedules[0].id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ status })
      .expect(400);
    expect((await detail()).body.schedules).toEqual(before);
  });

  it('rejects canceling the playing slot through PATCH and preserves its state', async () => {
    await controlRequest(data.hostMusician.token, 'start', data.jam.id);
    const before = (await detail()).body;
    await request(app.getHttpServer())
      .patch(`/escalas/${data.schedules[0].id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ status: 'CANCELED' })
      .expect(400);
    expect((await detail()).body).toEqual(before);
  });

  it('rejects replacing music after a musician has registered', async () => {
    await request(app.getHttpServer())
      .post('/inscricoes')
      .set('Authorization', `Bearer ${data.musician.token}`)
      .send({ scheduleId: data.schedules[0].id, instrument: 'guitar' })
      .expect(201);
    const before = (await detail()).body.schedules;
    await request(app.getHttpServer())
      .patch(`/escalas/${data.schedules[0].id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ musicId: data.songs[1].id })
      .expect(400);
    expect((await detail()).body.schedules).toEqual(before);
  });

  it('requires the reorder operation for changing queue positions', async () => {
    const before = (await detail()).body.schedules;
    await request(app.getHttpServer())
      .patch(`/escalas/${data.schedules[0].id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ order: 99 })
      .expect(400);
    expect((await detail()).body.schedules).toEqual(before);
  });
  it('deletes an empty unplayed slot', async () => {
    await remove(data.schedules[1].id).expect(200);
    expect((await detail()).body.schedules.map((song: { id: string }) => song.id)).toEqual([
      data.schedules[0].id,
      data.schedules[2].id,
      data.schedules[3].id,
    ]);
  });

  it('preserves completed songs and their history', async () => {
    await controlRequest(data.hostMusician.token, 'start', data.jam.id);
    await controlRequest(data.hostMusician.token, 'next', data.jam.id);
    const before = (await detail()).body;
    const previousHistory = (await history()).body;
    await remove(data.schedules[0].id).expect(400);
    expect((await detail()).body).toEqual(before);
    expect((await history()).body).toEqual(previousHistory);
  });

  it.each(['SUGGESTED', 'SCHEDULED', 'CANCELED'])(
    'allows queue approval/rejection into %s for unplayed slots',
    async (status) => {
      await request(app.getHttpServer())
        .patch(`/escalas/${data.schedules[0].id}`)
        .set('Authorization', `Bearer ${data.hostMusician.token}`)
        .send({ status })
        .expect(200);
      expect((await detail()).body.schedules[0].status).toBe(status);
    },
  );

  it('allows music replacement before registrations or history exist', async () => {
    await request(app.getHttpServer())
      .patch(`/escalas/${data.schedules[0].id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ musicId: data.songs[1].id })
      .expect(200);
    expect((await detail()).body.schedules[0].musicId).toBe(data.songs[1].id);
  });

  it('rejects music replacement once an unplayed slot has history', async () => {
    await controlRequest(data.hostMusician.token, 'reorder', data.jam.id, 200, {
      updates: [{ scheduleId: data.schedules[0].id, order: 1 }],
    });
    const before = (await detail()).body.schedules;
    await request(app.getHttpServer())
      .patch(`/escalas/${data.schedules[0].id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ musicId: data.songs[1].id })
      .expect(400);
    expect((await detail()).body.schedules).toEqual(before);
  });

  it('does not lose a successful registration racing slot removal', async () => {
    const [registration] = await Promise.all([
      request(app.getHttpServer())
        .post('/inscricoes')
        .set('Authorization', `Bearer ${data.musician.token}`)
        .send({ scheduleId: data.schedules[0].id, instrument: 'guitar' }),
      remove(data.schedules[0].id).expect(200),
    ]);
    expect([201, 400, 404]).toContain(registration.status);
    const slot = (await detail()).body.schedules.find(
      (song: { id: string }) => song.id === data.schedules[0].id,
    );
    if (registration.status === 201) {
      expect(slot).toMatchObject({
        status: 'CANCELED',
        registrations: [expect.objectContaining({ id: registration.body.id })],
      });
    } else {
      expect(slot).toBeUndefined();
    }
  });
});
