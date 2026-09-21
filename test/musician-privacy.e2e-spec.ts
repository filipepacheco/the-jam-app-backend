import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { closeApp, initializeApp, testFixtures } from './test-helpers';

describe('Musician profile privacy (disposable PostgreSQL)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await initializeApp();
  });

  afterAll(closeApp);

  beforeEach(() => testFixtures.cleanup());
  afterEach(() => testFixtures.cleanup());

  it('keeps phone and contact private to the authenticated musician profile', async () => {
    const musician = await testFixtures.createMusician({
      name: 'Private Musician',
      phone: '+5511999999999',
      contact: 'private-contact@example.invalid',
    });
    const otherMusician = await testFixtures.createMusician({ name: 'Other Musician' });
    const unrelatedHost = await testFixtures.createMusician({
      name: 'Unrelated Host',
      isHost: true,
    });

    const listing = await request(app.getHttpServer())
      .get('/musicos')
      .set('Authorization', `Bearer ${otherMusician.token}`)
      .expect(200);
    const listed = listing.body.data.find((entry: { id: string }) => entry.id === musician.id);
    expect(listed).toEqual(expect.objectContaining({ id: musician.id, name: 'Private Musician' }));
    expect(listed).not.toHaveProperty('phone');
    expect(listed).not.toHaveProperty('contact');

    const detail = await request(app.getHttpServer())
      .get(`/musicos/${musician.id}`)
      .set('Authorization', `Bearer ${otherMusician.token}`)
      .expect(200);
    expect(detail.body).not.toHaveProperty('phone');
    expect(detail.body).not.toHaveProperty('contact');

    const ownProfile = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${musician.token}`)
      .expect(200);
    expect(ownProfile.body).toMatchObject({
      id: musician.id,
      phone: '+5511999999999',
      contact: 'private-contact@example.invalid',
    });

    await request(app.getHttpServer())
      .patch(`/musicos/${musician.id}`)
      .set('Authorization', `Bearer ${unrelatedHost.token}`)
      .send({ phone: '+5511888888888', contact: 'replaced@example.invalid' })
      .expect(403);

    const unchangedProfile = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${musician.token}`)
      .expect(200);
    expect(unchangedProfile.body).toMatchObject({
      phone: '+5511999999999',
      contact: 'private-contact@example.invalid',
    });
  });
});
