import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  closeApp,
  getPrismaService,
  initializeApp,
  setupTestData,
  testFixtures,
} from './test-helpers';

describe('Registration identity (disposable PostgreSQL)', () => {
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

  it('accepts only one concurrent application for the same musician, slot and instrument', async () => {
    const register = () =>
      request(app.getHttpServer())
        .post('/inscricoes')
        .set('Authorization', `Bearer ${data.musician.token}`)
        .send({ scheduleId: data.schedules[0].id, instrument: 'guitar' });

    const responses = await Promise.all([register(), register()]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  });

  it('allows a musician to apply for multiple instruments on one slot', async () => {
    const register = (instrument: string) =>
      request(app.getHttpServer())
        .post('/inscricoes')
        .set('Authorization', `Bearer ${data.musician.token}`)
        .send({ scheduleId: data.schedules[0].id, instrument })
        .expect(201);

    const [guitar, bass] = await Promise.all([register('guitar'), register('bass')]);

    expect(guitar.body).toMatchObject({
      scheduleId: data.schedules[0].id,
      instrument: 'guitars',
    });
    expect(bass.body).toMatchObject({
      scheduleId: data.schedules[0].id,
      instrument: 'bass',
    });
  });

  it('treats repeated occurrences of the same song as distinct slots', async () => {
    const repeatedSlot = await getPrismaService().schedule.create({
      data: {
        jamId: data.jam.id,
        musicId: data.songs[0].id,
        order: 5,
        status: 'SCHEDULED',
      },
    });
    const register = (scheduleId: string) =>
      request(app.getHttpServer())
        .post('/inscricoes')
        .set('Authorization', `Bearer ${data.musician.token}`)
        .send({ scheduleId, instrument: 'guitar' })
        .expect(201);

    const [firstOccurrence, repeatedOccurrence] = await Promise.all([
      register(data.schedules[0].id),
      register(repeatedSlot.id),
    ]);

    expect(firstOccurrence.body.scheduleId).toBe(data.schedules[0].id);
    expect(repeatedOccurrence.body.scheduleId).toBe(repeatedSlot.id);
  });

  it('rejects changing an application into another application identity', async () => {
    const create = (instrument: string) =>
      request(app.getHttpServer())
        .post('/inscricoes')
        .set('Authorization', `Bearer ${data.musician.token}`)
        .send({ scheduleId: data.schedules[0].id, instrument })
        .expect(201);
    const [guitar, bass] = await Promise.all([create('guitar'), create('bass')]);

    await request(app.getHttpServer())
      .patch(`/inscricoes/${guitar.body.id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ instrument: bass.body.instrument })
      .expect(409);
  });
});
