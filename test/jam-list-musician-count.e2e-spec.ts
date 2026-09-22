import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { closeApp, getPrismaService, initializeApp, testFixtures } from './test-helpers';

describe('Jam list musician count (disposable PostgreSQL)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await initializeApp();
  });

  afterAll(closeApp);

  beforeEach(() => testFixtures.cleanup());
  afterEach(() => testFixtures.cleanup());

  it('counts distinct musicians with pending or approved registrations, not applications', async () => {
    const host = await testFixtures.createMusician({ isHost: true });
    const participating = await testFixtures.createMusician({ name: 'Participating' });
    const pending = await testFixtures.createMusician({ name: 'Pending' });
    const rejected = await testFixtures.createMusician({ name: 'Rejected' });
    const withdrawn = await testFixtures.createMusician({ name: 'Withdrawn' });
    const music = await testFixtures.createMusic();
    const jam = await testFixtures.createJam(host.id, { name: 'Counted jam' });
    const emptyJam = await testFixtures.createJam(host.id, { name: 'Empty jam' });
    const [first, second] = await testFixtures.createSchedules(jam.id, [music.id, music.id]);

    await getPrismaService().registration.createMany({
      data: [
        {
          jamId: jam.id,
          scheduleId: first.id,
          musicianId: participating.id,
          instrument: 'vocals',
          status: 'APPROVED',
        },
        {
          jamId: jam.id,
          scheduleId: second.id,
          musicianId: participating.id,
          instrument: 'guitar',
          status: 'APPROVED',
        },
        {
          jamId: jam.id,
          scheduleId: first.id,
          musicianId: pending.id,
          instrument: 'bass',
          status: 'PENDING',
        },
        {
          jamId: jam.id,
          scheduleId: first.id,
          musicianId: rejected.id,
          instrument: 'drums',
          status: 'REJECTED',
        },
        {
          jamId: jam.id,
          scheduleId: first.id,
          musicianId: withdrawn.id,
          instrument: 'keys',
          status: 'WITHDRAWN',
        },
      ],
    });

    const response = await request(app.getHttpServer()).get('/jams').expect(200);
    const listed = response.body.data.find((item: { id: string }) => item.id === jam.id);
    const empty = response.body.data.find((item: { id: string }) => item.id === emptyJam.id);

    expect(listed._count.registrations).toBe(5);
    expect(listed.registeredMusicianCount).toBe(2);
    expect(empty.registeredMusicianCount).toBe(0);
  });
});
