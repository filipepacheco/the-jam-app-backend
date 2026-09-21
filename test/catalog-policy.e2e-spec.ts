import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  closeApp,
  getPrismaService,
  initializeApp,
  setupTestData,
  testFixtures,
} from './test-helpers';

describe('Catalog authority and public projection (disposable PostgreSQL)', () => {
  let app: INestApplication;
  let data: Awaited<ReturnType<typeof setupTestData>>;

  beforeAll(async () => {
    app = await initializeApp();
  });

  beforeEach(async () => {
    await testFixtures.cleanup();
    data = await setupTestData();
  });

  afterAll(async () => {
    await testFixtures.cleanup();
    await closeApp();
  });

  it('exposes only safe jam fields in the public music catalog', async () => {
    await getPrismaService().jam.update({
      where: { id: data.jam.id },
      data: {
        hostContact: 'private@example.invalid',
        qrCode: 'private-qr',
        spotifyImportKey: 'private-import-key',
      },
    });
    await getPrismaService().jamMusic.create({
      data: { jamId: data.jam.id, musicId: data.songs[0].id },
    });

    const catalog = await request(app.getHttpServer()).get('/musicas').expect(200);
    const song = catalog.body.data.find((item: { id: string }) => item.id === data.songs[0].id);
    const jam = song.jamMusics[0].jam;

    expect(jam).toEqual(
      expect.objectContaining({ id: data.jam.id, name: data.jam.name, status: 'ACTIVE' }),
    );
    expect(jam).not.toHaveProperty('hostContact');
    expect(jam).not.toHaveProperty('hostName');
    expect(jam).not.toHaveProperty('hostMusicianId');
    expect(jam).not.toHaveProperty('qrCode');
    expect(jam).not.toHaveProperty('spotifyImportKey');
  });

  it('allows only hosts to mutate the shared music catalog', async () => {
    await request(app.getHttpServer())
      .patch(`/musicas/${data.songs[0].id}`)
      .set('Authorization', `Bearer ${data.musician.token}`)
      .send({ title: 'Unauthorized edit' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/musicas/${data.songs[0].id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ title: 'Host edit' })
      .expect(200)
      .expect(({ body }) => expect(body.title).toBe('Host edit'));
  });

  it('reserves event links and arrangement notes for the event owner', async () => {
    const otherHost = await testFixtures.createMusician({ isHost: true });
    const jamMusic = await getPrismaService().jamMusic.create({
      data: { jamId: data.jam.id, musicId: data.songs[0].id },
    });

    await request(app.getHttpServer())
      .patch(`/musicas/jam-music/${jamMusic.id}/jam/${data.jam.id}`)
      .set('Authorization', `Bearer ${otherHost.token}`)
      .send({ notes: 'Unauthorized notes' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/musicas/${data.songs[1].id}/link-jam/${data.jam.id}`)
      .set('Authorization', `Bearer ${otherHost.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/musicas/jam-music/${jamMusic.id}/jam/${data.jam.id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .send({ notes: 'Owner notes' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/musicas/${data.songs[1].id}/link-jam/${data.jam.id}`)
      .set('Authorization', `Bearer ${data.hostMusician.token}`)
      .expect(200);
  });
});
