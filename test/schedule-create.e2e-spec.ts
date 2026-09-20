import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { closeApp, initializeApp, setupTestData, testFixtures } from './test-helpers';

describe('Schedule creation HTTP contract (disposable PostgreSQL)', () => {
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

  const schedules = async () => {
    const response = await request(app.getHttpServer()).get(`/jams/${data.jam.id}`).expect(200);
    return response.body.schedules;
  };

  const liveState = () =>
    request(app.getHttpServer()).get(`/jams/${data.jam.id}/live/state`).expect(200);

  it.each(['IN_PROGRESS', 'COMPLETED'])(
    'rejects a host creating a %s schedule without adding a queue row or changing playback',
    async (status) => {
      const music = await testFixtures.createMusic();
      const schedulesBefore = await schedules();
      const stateBefore = (await liveState()).body;

      await request(app.getHttpServer())
        .post('/escalas')
        .set('Authorization', `Bearer ${data.hostMusician.token}`)
        .send({ jamId: data.jam.id, musicId: music.id, order: 99, status })
        .expect(400);

      expect(await schedules()).toEqual(schedulesBefore);
      expect((await liveState()).body).toEqual(stateBefore);
    },
  );

  it('continues to forbid an ordinary musician from creating a privileged schedule', async () => {
    const music = await testFixtures.createMusic();

    await request(app.getHttpServer())
      .post('/escalas')
      .set('Authorization', `Bearer ${data.musician.token}`)
      .send({ jamId: data.jam.id, musicId: music.id, order: 99, status: 'SCHEDULED' })
      .expect(403);
  });

  it('allows a host to create a scheduled queue entry', async () => {
    const music = await testFixtures.createMusic();

    await request(app.getHttpServer())
      .post('/escalas')
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ jamId: data.jam.id, musicId: music.id, order: 99, status: 'SCHEDULED' })
      .expect(201);

    expect((await schedules()).map((schedule: { musicId: string }) => schedule.musicId)).toContain(
      music.id,
    );
  });
});
