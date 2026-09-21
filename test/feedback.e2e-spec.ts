import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { initializeApp, createTestApp, closeApp, testFixtures } from './test-helpers';

describe('Feedback rate limit over HTTP (disposable PostgreSQL)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await initializeApp();
  });
  beforeEach(async () => {
    await testFixtures.cleanup();
  });
  afterAll(async () => {
    await testFixtures.cleanup();
    await closeApp();
  });

  it('shares the five-submission limit across anonymous and authenticated requests from one client', async () => {
    const host = await testFixtures.createMusician({ isHost: true });
    for (let i = 0; i < 4; i++) {
      await request(app.getHttpServer()).post('/feedback').send({ rating: 4 }).expect(201);
    }
    const authenticated = await request(app.getHttpServer())
      .post('/feedback')
      .set('Authorization', `Bearer ${host.token}`)
      .send({ rating: 4 })
      .expect(201);
    expect(authenticated.body.musicianId).toBe(host.id);
    const rejected = await request(app.getHttpServer())
      .post('/feedback')
      .send({ rating: 1 })
      .expect(429);
    expect(Number(rejected.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(rejected.headers['retry-after'])).toBeLessThanOrEqual(3600);
    await request(app.getHttpServer())
      .post('/feedback')
      .set('Authorization', `Bearer ${host.token}`)
      .send({ rating: 1 })
      .expect(429);
    const list = await request(app.getHttpServer())
      .get('/feedback')
      .set('Authorization', `Bearer ${host.token}`)
      .expect(200);
    expect(list.body.total).toBe(5);
    expect(list.body.items.map((item: { rating: number }) => item.rating)).toEqual([4, 4, 4, 4, 4]);

    const afterBlock = Date.now() + 60 * 60 * 1000 + 1;
    const clock = jest.spyOn(Date, 'now').mockReturnValue(afterBlock);
    try {
      await request(app.getHttpServer()).post('/feedback').send({ rating: 3 }).expect(201);
    } finally {
      clock.mockRestore();
    }
  });

  it('enforces one shared quota across application instances', async () => {
    const secondApp = await createTestApp();
    const clientIp = '203.0.113.10';

    try {
      const submissions = await Promise.all(
        Array.from({ length: 6 }, (_, index) =>
          request(index % 2 === 0 ? app.getHttpServer() : secondApp.getHttpServer())
            .post('/feedback')
            .set('X-Forwarded-For', index % 2 === 0 ? clientIp : `::ffff:${clientIp}`)
            .send({ rating: 5 }),
        ),
      );

      expect(submissions.map(({ status }) => status).sort()).toEqual([
        201, 201, 201, 201, 201, 429,
      ]);
      expect(await testFixtures.getFeedbackCount()).toBe(5);
    } finally {
      await secondApp.close();
    }
  });
});
