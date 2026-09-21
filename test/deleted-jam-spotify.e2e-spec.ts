import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { SpotifyApiClient } from '../src/spotify/spotify-api.client';
import { closeApp, initializeApp, setupTestData, testFixtures } from './test-helpers';

describe('Spotify operations after jam deletion', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await initializeApp();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await testFixtures.cleanup();
  });
  afterAll(closeApp);

  it('rejects import before contacting Spotify and leaves the catalog unchanged', async () => {
    const { jam, hostMusician } = await setupTestData();
    const api = app.get(SpotifyApiClient);
    jest.spyOn(api, 'getClientToken').mockRejectedValue(new Error('Unexpected provider access'));
    const before = await request(app.getHttpServer()).get('/musicas').expect(200);
    await request(app.getHttpServer())
      .delete(`/jams/${jam.id}`)
      .set('Authorization', `Bearer ${hostMusician.token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/spotify/import')
      .set('Authorization', `Bearer ${hostMusician.token}`)
      .send({
        playlistUrl: 'https://open.spotify.com/playlist/1234567890123456789012',
        jamId: jam.id,
      })
      .expect(404);
    const after = await request(app.getHttpServer()).get('/musicas').expect(200);
    expect(after.body).toEqual(before.body);
  });

  it('rejects export of a deleted jam before creating an external playlist', async () => {
    const { jam, hostMusician } = await setupTestData();
    await request(app.getHttpServer())
      .delete(`/jams/${jam.id}`)
      .set('Authorization', `Bearer ${hostMusician.token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/spotify/export')
      .set('Authorization', `Bearer ${hostMusician.token}`)
      .send({ jamId: jam.id, spotifyAccessToken: 'test-only' })
      .expect(404);
  });
});
