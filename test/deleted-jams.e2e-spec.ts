import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  closeApp,
  controlRequest,
  getPrismaService,
  initializeApp,
  setupTestData,
  testFixtures,
} from './test-helpers';

describe('Deleted jam HTTP contract (disposable PostgreSQL)', () => {
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

  async function deleteJam() {
    await request(app.getHttpServer())
      .delete(`/jams/${data.jam.id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .expect(200);
  }

  async function createRegistration() {
    return getPrismaService().registration.create({
      data: {
        musicianId: data.musician.id,
        jamId: data.jam.id,
        scheduleId: data.schedules[0].id,
        instrument: 'guitar',
      },
    });
  }

  it('returns 404 for a deleted jam live state', async () => {
    await deleteJam();

    await request(app.getHttpServer()).get(`/jams/${data.jam.id}/live/state`).expect(404);
  });

  it('returns 404 for a deleted jam live dashboard', async () => {
    await deleteJam();

    await request(app.getHttpServer()).get(`/jams/${data.jam.id}/live/dashboard`).expect(404);
  });

  it.each(['start', 'stop', 'next', 'previous', 'pause', 'resume'])(
    'rejects %s playback for a deleted jam',
    async (action) => {
      await deleteJam();

      await controlRequest(data.hostMusician.token, action, data.jam.id, 404);
    },
  );

  it('rejects queue reordering for a deleted jam', async () => {
    await deleteJam();

    await controlRequest(data.hostMusician.token, 'reorder', data.jam.id, 404, {
      updates: [{ scheduleId: data.schedules[0].id, order: 2 }],
    });
  });

  it('returns 404 for deleted jam playback history', async () => {
    await deleteJam();

    await request(app.getHttpServer())
      .get(`/jams/${data.jam.id}/playback-history`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .expect(404);
  });

  it('rejects schedule creation for a deleted jam', async () => {
    await deleteJam();

    await request(app.getHttpServer())
      .post('/escalas')
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ jamId: data.jam.id, musicId: data.songs[0].id, order: 5, status: 'SCHEDULED' })
      .expect(404);
  });

  it('rejects schedule updates for a deleted jam', async () => {
    await deleteJam();

    await request(app.getHttpServer())
      .patch(`/escalas/${data.schedules[0].id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ status: 'CANCELED' })
      .expect(404);
  });

  it('rejects schedule deletion for a deleted jam', async () => {
    await deleteJam();

    await request(app.getHttpServer())
      .delete(`/escalas/${data.schedules[0].id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .expect(404);
  });

  it('rejects registration creation for a deleted jam', async () => {
    await deleteJam();

    await request(app.getHttpServer())
      .post('/inscricoes')
      .set('Authorization', `Bearer ${data.musician.token}`)
      .send({ scheduleId: data.schedules[1].id, instrument: 'bass' })
      .expect(404);
  });

  it('rejects registration updates for a deleted jam', async () => {
    const registration = await createRegistration();
    await deleteJam();

    await request(app.getHttpServer())
      .patch(`/inscricoes/${registration.id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ status: 'APPROVED' })
      .expect(404);
  });

  it('rejects registration deletion for a deleted jam', async () => {
    const registration = await createRegistration();
    await deleteJam();

    await request(app.getHttpServer())
      .delete(`/inscricoes/${registration.id}`)
      .set('Authorization', `Bearer ${data.musician.token}`)
      .expect(404);
  });

  it('omits deleted jam relations from the public catalog', async () => {
    const activeJam = await testFixtures.createJam(data.hostMusician.id);
    await getPrismaService().jamMusic.create({
      data: { jamId: data.jam.id, musicId: data.songs[0].id },
    });
    await getPrismaService().jamMusic.create({
      data: { jamId: activeJam.id, musicId: data.songs[1].id },
    });
    await deleteJam();

    const catalog = await request(app.getHttpServer()).get('/musicas').expect(200);
    const song = catalog.body.data.find((item: { id: string }) => item.id === data.songs[0].id);
    expect(song.jamMusics).toEqual([]);

    const activeSong = catalog.body.data.find(
      (item: { id: string }) => item.id === data.songs[1].id,
    );
    expect(activeSong.jamMusics).toEqual([
      expect.objectContaining({
        jamId: activeJam.id,
        jam: expect.objectContaining({ id: activeJam.id }),
      }),
    ]);
  });

  it('rejects jam music notes updates for a deleted jam', async () => {
    const jamMusic = await getPrismaService().jamMusic.create({
      data: { jamId: data.jam.id, musicId: data.songs[0].id },
    });
    await deleteJam();

    await request(app.getHttpServer())
      .patch(`/musicas/jam-music/${jamMusic.id}/jam/${data.jam.id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ notes: 'No longer editable' })
      .expect(404);
  });

  it('rejects music links to a deleted jam', async () => {
    await deleteJam();

    await request(app.getHttpServer())
      .patch(`/musicas/${data.songs[1].id}/link-jam/${data.jam.id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .expect(404);
  });

  it('rejects moving a schedule to a deleted jam', async () => {
    const deletedTarget = await testFixtures.createJam(data.hostMusician.id);
    await request(app.getHttpServer())
      .delete(`/jams/${deletedTarget.id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/escalas/${data.schedules[0].id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ jamId: deletedTarget.id })
      .expect(404);
  });
});
