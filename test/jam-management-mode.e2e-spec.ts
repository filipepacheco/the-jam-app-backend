import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { closeApp, initializeApp, setupTestData, testFixtures } from './test-helpers';

describe('Jam management mode (disposable PostgreSQL)', () => {
  let app: INestApplication;
  let data: Awaited<ReturnType<typeof setupTestData>>;
  let otherHost: Awaited<ReturnType<typeof testFixtures.createMusician>>;

  beforeAll(async () => {
    app = await initializeApp();
  });

  afterAll(closeApp);

  beforeEach(async () => {
    await testFixtures.cleanup();
    data = await setupTestData();
    otherHost = await testFixtures.createMusician({ name: 'Another Host', isHost: true });
  });

  afterEach(() => testFixtures.cleanup());

  it('defaults a new event to owner-only playback management', async () => {
    await request(app.getHttpServer())
      .post(`/jams/${data.jam.id}/control/start`)
      .set('Authorization', `Bearer ${otherHost.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/jams/${data.jam.id}/control/start`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .expect(200);
  });

  it('makes the authenticated creator the owner of a new owner-only event', async () => {
    const created = await request(app.getHttpServer())
      .post('/jams')
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ name: 'Creator-owned jam' })
      .expect(201);

    expect(created.body).toMatchObject({
      hostMusicianId: data.hostMusician.id,
      managementMode: 'OWNER_ONLY',
    });

    await request(app.getHttpServer())
      .post(`/jams/${created.body.id}/control/start`)
      .set('Authorization', `Bearer ${otherHost.token}`)
      .expect(403);
  });

  it('allows only the event owner to enable shared host management', async () => {
    await request(app.getHttpServer())
      .patch(`/jams/${data.jam.id}`)
      .set('Authorization', `Bearer ${otherHost.token}`)
      .send({ managementMode: 'SHARED_HOSTS' })
      .expect(403);

    const updated = await request(app.getHttpServer())
      .patch(`/jams/${data.jam.id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ managementMode: 'SHARED_HOSTS' })
      .expect(200);

    expect(updated.body.managementMode).toBe('SHARED_HOSTS');
  });

  it('lets every global host manage playback, queue actions, and approvals when shared', async () => {
    await request(app.getHttpServer())
      .patch(`/jams/${data.jam.id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ managementMode: 'SHARED_HOSTS' })
      .expect(200);
    const registration = await request(app.getHttpServer())
      .post('/inscricoes')
      .set('Authorization', `Bearer ${data.musician.token}`)
      .send({ scheduleId: data.schedules[0].id, instrument: 'guitar' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/jams/${data.jam.id}/control/reorder`)
      .set('Authorization', `Bearer ${otherHost.token}`)
      .send({ updates: [{ scheduleId: data.schedules[1].id, order: 1 }] })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/escalas/${data.schedules[2].id}`)
      .set('Authorization', `Bearer ${otherHost.token}`)
      .send({ status: 'CANCELED' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/escalas/${data.schedules[3].id}`)
      .set('Authorization', `Bearer ${otherHost.token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/escalas')
      .set('Authorization', `Bearer ${otherHost.token}`)
      .send({
        jamId: data.jam.id,
        musicId: data.songs[0].id,
        order: 99,
        status: 'SCHEDULED',
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/inscricoes/${registration.body.id}`)
      .set('Authorization', `Bearer ${otherHost.token}`)
      .send({ status: 'APPROVED' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/jams/${data.jam.id}/control/start`)
      .set('Authorization', `Bearer ${otherHost.token}`)
      .expect(200);
  });

  it('keeps queue actions and approvals owner-only until sharing is enabled', async () => {
    const registration = await request(app.getHttpServer())
      .post('/inscricoes')
      .set('Authorization', `Bearer ${data.musician.token}`)
      .send({ scheduleId: data.schedules[0].id, instrument: 'guitar' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/jams/${data.jam.id}/control/reorder`)
      .set('Authorization', `Bearer ${otherHost.token}`)
      .send({ updates: [{ scheduleId: data.schedules[1].id, order: 1 }] })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/escalas/${data.schedules[2].id}`)
      .set('Authorization', `Bearer ${otherHost.token}`)
      .send({ status: 'CANCELED' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/escalas/${data.schedules[3].id}`)
      .set('Authorization', `Bearer ${otherHost.token}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/escalas')
      .set('Authorization', `Bearer ${otherHost.token}`)
      .send({
        jamId: data.jam.id,
        musicId: data.songs[0].id,
        order: 99,
        status: 'SCHEDULED',
      })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/inscricoes/${registration.body.id}`)
      .set('Authorization', `Bearer ${otherHost.token}`)
      .send({ status: 'APPROVED' })
      .expect(403);
  });

  it('does not extend shared management to deleting the event', async () => {
    await request(app.getHttpServer())
      .patch(`/jams/${data.jam.id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ managementMode: 'SHARED_HOSTS' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/jams/${data.jam.id}`)
      .set('Authorization', `Bearer ${otherHost.token}`)
      .expect(403);
  });
});
