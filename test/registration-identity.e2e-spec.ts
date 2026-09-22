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
    await getPrismaService().jam.update({
      where: { id: data.jam.id },
      data: { autoApproveRegistrations: false },
    });
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

    const approved = await Promise.all(
      [guitar, bass].map((registration) =>
        request(app.getHttpServer())
          .patch(`/inscricoes/${registration.body.id}`)
          .set('Authorization', `Bearer ${data.hostMusician.token}`)
          .send({ status: 'APPROVED' })
          .expect(200),
      ),
    );

    expect(approved.map((registration) => registration.body.status)).toEqual([
      'APPROVED',
      'APPROVED',
    ]);
  });

  it('accepts a redundant musicianId when it matches the authenticated musician', async () => {
    const registration = await request(app.getHttpServer())
      .post('/inscricoes')
      .set('Authorization', `Bearer ${data.musician.token}`)
      .send({
        scheduleId: data.schedules[0].id,
        musicianId: data.musician.id,
        instrument: 'guitar',
      })
      .expect(201);

    expect(registration.body).toMatchObject({
      musicianId: data.musician.id,
      scheduleId: data.schedules[0].id,
      instrument: 'guitars',
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

  it('does not let a host apply on behalf of another musician', async () => {
    await request(app.getHttpServer())
      .post('/inscricoes')
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({
        scheduleId: data.schedules[0].id,
        musicianId: data.musician.id,
        instrument: 'guitar',
      })
      .expect(403);
  });

  it('rejects applications for canceled, started, and completed slots', async () => {
    const statuses = ['CANCELED', 'IN_PROGRESS', 'COMPLETED'] as const;

    for (const [index, status] of statuses.entries()) {
      await getPrismaService().schedule.update({
        where: { id: data.schedules[index].id },
        data: { status },
      });

      await request(app.getHttpServer())
        .post('/inscricoes')
        .set('Authorization', `Bearer ${data.musician.token}`)
        .send({ scheduleId: data.schedules[index].id, instrument: 'guitar' })
        .expect(400);
    }
  });

  it('rejects applications when the event is inactive or finished', async () => {
    for (const [index, status] of (['INACTIVE', 'FINISHED'] as const).entries()) {
      await getPrismaService().jam.update({
        where: { id: data.jam.id },
        data: { status },
      });

      await request(app.getHttpServer())
        .post('/inscricoes')
        .set('Authorization', `Bearer ${data.musician.token}`)
        .send({ scheduleId: data.schedules[index].id, instrument: 'guitar' })
        .expect(400);

      await getPrismaService().jam.update({
        where: { id: data.jam.id },
        data: { status: 'ACTIVE' },
      });
    }
  });

  it('allows an ordinary musician to withdraw only their own registration', async () => {
    const anotherMusician = await testFixtures.createMusician({ name: 'Another Musician' });
    const registration = await request(app.getHttpServer())
      .post('/inscricoes')
      .set('Authorization', `Bearer ${data.musician.token}`)
      .send({ scheduleId: data.schedules[0].id, instrument: 'guitar' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/inscricoes/${registration.body.id}`)
      .set('Authorization', `Bearer ${anotherMusician.token}`)
      .expect(403);
  });

  it('allows an event manager to approve a withdrawn registration', async () => {
    const registration = await request(app.getHttpServer())
      .post('/inscricoes')
      .set('Authorization', `Bearer ${data.musician.token}`)
      .send({ scheduleId: data.schedules[0].id, instrument: 'guitar' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/inscricoes/${registration.body.id}`)
      .set('Authorization', `Bearer ${data.musician.token}`)
      .expect(200);

    const restored = await request(app.getHttpServer())
      .patch(`/inscricoes/${registration.body.id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ status: 'APPROVED' })
      .expect(200);

    expect(restored.body).toMatchObject({
      id: registration.body.id,
      status: 'APPROVED',
    });
  });

  it('locks an approved registration instrument and preserves a withdrawal', async () => {
    const registration = await request(app.getHttpServer())
      .post('/inscricoes')
      .set('Authorization', `Bearer ${data.musician.token}`)
      .send({ scheduleId: data.schedules[0].id, instrument: 'guitar' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/inscricoes/${registration.body.id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ status: 'APPROVED' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/inscricoes/${registration.body.id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ instrument: 'bass' })
      .expect(400);

    const withdrawal = await request(app.getHttpServer())
      .delete(`/inscricoes/${registration.body.id}`)
      .set('Authorization', `Bearer ${data.musician.token}`)
      .expect(200);

    expect(withdrawal.body).toMatchObject({ id: registration.body.id, status: 'WITHDRAWN' });

    await request(app.getHttpServer())
      .post('/inscricoes')
      .set('Authorization', `Bearer ${data.musician.token}`)
      .send({ scheduleId: data.schedules[0].id, instrument: 'guitar' })
      .expect(409);
  });

  it('allows the event manager to reopen rejected applications, but not to mutate started slots', async () => {
    const registration = await request(app.getHttpServer())
      .post('/inscricoes')
      .set('Authorization', `Bearer ${data.musician.token}`)
      .send({ scheduleId: data.schedules[0].id, instrument: 'guitar' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/inscricoes/${registration.body.id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ status: 'REJECTED' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/inscricoes/${registration.body.id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ status: 'PENDING' })
      .expect(200);

    await getPrismaService().schedule.update({
      where: { id: data.schedules[0].id },
      data: { status: 'IN_PROGRESS' },
    });

    await request(app.getHttpServer())
      .patch(`/inscricoes/${registration.body.id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ status: 'APPROVED' })
      .expect(400);
  });
});
