import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { SpotifyApiClient } from '../src/spotify/spotify-api.client';
import { closeApp, initializeApp, testFixtures } from './test-helpers';

describe('Spotify integration failure contract (disposable PostgreSQL)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await initializeApp();
  });

  afterAll(closeApp);

  beforeEach(() => testFixtures.cleanup());
  afterEach(() => jest.restoreAllMocks());

  it('reports the partially created remote playlist when track population fails', async () => {
    const host = await testFixtures.createMusician({ isHost: true });
    const music = await testFixtures.createMusic({
      link: 'https://open.spotify.com/track/partial-export-track',
    });
    const jam = await testFixtures.createJam(host.id);
    await testFixtures.createSchedules(jam.id, [music.id]);
    const spotifyApi = app.get(SpotifyApiClient);
    jest.spyOn(spotifyApi, 'getCurrentUserId').mockResolvedValue('spotify-user');
    jest.spyOn(spotifyApi, 'createPlaylist').mockResolvedValue({
      id: 'partial-playlist',
      externalUrl: 'https://open.spotify.com/playlist/partial-playlist',
    });
    jest.spyOn(spotifyApi, 'addTracksToPlaylist').mockRejectedValue(new Error('provider timeout'));

    const response = await request(app.getHttpServer())
      .post('/spotify/export')
      .set('Authorization', `Bearer ${host.token}`)
      .send({ jamId: jam.id, spotifyAccessToken: 'spotify-token' })
      .expect(502);

    expect(response.body).toMatchObject({
      message: 'Spotify playlist was created but tracks could not be added',
      details: {
        partialPlaylistId: 'partial-playlist',
        partialPlaylistUrl: 'https://open.spotify.com/playlist/partial-playlist',
      },
    });
  });
});
