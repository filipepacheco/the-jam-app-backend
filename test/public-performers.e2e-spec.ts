import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { closeApp, getPrismaService, initializeApp, testFixtures } from './test-helpers';

async function setupPublicPerformers() {
  const host = await testFixtures.createMusician({ name: 'Host', isHost: true });
  const approvedCurrent = await testFixtures.createMusician({ name: 'Approved Current' });
  const pendingCurrent = await testFixtures.createMusician({ name: 'Pending Current' });
  const rejectedCurrent = await testFixtures.createMusician({ name: 'Rejected Current' });
  const approvedNext = await testFixtures.createMusician({ name: 'Approved Next' });
  const pendingNext = await testFixtures.createMusician({ name: 'Pending Next' });
  const rejectedNext = await testFixtures.createMusician({ name: 'Rejected Next' });
  const currentMusic = await testFixtures.createMusic({
    title: 'Current Song',
    artist: 'Current Artist',
    duration: 241,
    link: 'https://example.invalid/current',
  });
  const nextMusic = await testFixtures.createMusic({
    title: 'Next Song',
    artist: 'Next Artist',
    duration: 198,
    link: 'https://example.invalid/next',
  });
  const jam = await testFixtures.createJam(host.id, { name: 'Public Jam' });
  const [currentSchedule, nextSchedule] = await testFixtures.createSchedules(jam.id, [
    currentMusic.id,
    nextMusic.id,
  ]);
  await getPrismaService().schedule.update({
    where: { id: currentSchedule.id },
    data: { status: 'IN_PROGRESS' },
  });

  await getPrismaService().registration.createMany({
    data: [
      {
        jamId: jam.id,
        scheduleId: currentSchedule.id,
        musicianId: approvedCurrent.id,
        instrument: 'vocals',
        status: 'APPROVED',
      },
      {
        jamId: jam.id,
        scheduleId: currentSchedule.id,
        musicianId: pendingCurrent.id,
        instrument: 'guitar',
        status: 'PENDING',
      },
      {
        jamId: jam.id,
        scheduleId: currentSchedule.id,
        musicianId: rejectedCurrent.id,
        instrument: 'bass',
        status: 'REJECTED',
      },
      {
        jamId: jam.id,
        scheduleId: nextSchedule.id,
        musicianId: approvedNext.id,
        instrument: 'drums',
        status: 'APPROVED',
      },
      {
        jamId: jam.id,
        scheduleId: nextSchedule.id,
        musicianId: pendingNext.id,
        instrument: 'keys',
        status: 'PENDING',
      },
      {
        jamId: jam.id,
        scheduleId: nextSchedule.id,
        musicianId: rejectedNext.id,
        instrument: 'guitar',
        status: 'REJECTED',
      },
    ],
  });

  return {
    approvedCurrent,
    approvedNext,
    currentMusic,
    currentSchedule,
    jam,
    nextMusic,
    nextSchedule,
  };
}

describe('Public live performer visibility (disposable PostgreSQL)', () => {
  let app: INestApplication;
  let fixture: Awaited<ReturnType<typeof setupPublicPerformers>>;

  beforeAll(async () => {
    app = await initializeApp();
  });

  afterAll(closeApp);

  beforeEach(async () => {
    await testFixtures.cleanup();
    fixture = await setupPublicPerformers();
  });

  afterEach(() => testFixtures.cleanup());

  it('shows only approved performers in the public live state', async () => {
    const state = (
      await request(app.getHttpServer()).get(`/jams/${fixture.jam.id}/live/state`).expect(200)
    ).body;

    expect(state.currentSong).toMatchObject({
      id: fixture.currentSchedule.id,
      order: 1,
      status: 'IN_PROGRESS',
      music: {
        title: 'Current Song',
        artist: 'Current Artist',
        duration: 241,
        link: 'https://example.invalid/current',
      },
      musicians: [
        { id: fixture.approvedCurrent.id, name: 'Approved Current', instrument: 'vocals' },
      ],
    });
    expect(state.nextSongs).toEqual([
      expect.objectContaining({
        id: fixture.nextSchedule.id,
        order: 2,
        status: 'SCHEDULED',
        music: {
          title: 'Next Song',
          artist: 'Next Artist',
          duration: 198,
          link: 'https://example.invalid/next',
        },
        musicians: [{ id: fixture.approvedNext.id, name: 'Approved Next', instrument: 'drums' }],
      }),
    ]);
  });

  it('shows only approved performers in the public live dashboard', async () => {
    const dashboard = (
      await request(app.getHttpServer()).get(`/jams/${fixture.jam.id}/live/dashboard`).expect(200)
    ).body;

    expect(dashboard).toMatchObject({
      jamId: fixture.jam.id,
      jamName: 'Public Jam',
      currentSong: {
        id: fixture.currentMusic.id,
        title: 'Current Song',
        artist: 'Current Artist',
        duration: 241,
        link: 'https://example.invalid/current',
        musicians: [
          { id: fixture.approvedCurrent.id, name: 'Approved Current', instrument: 'vocals' },
        ],
      },
      nextSongs: [
        {
          id: fixture.nextMusic.id,
          title: 'Next Song',
          artist: 'Next Artist',
          duration: 198,
          link: 'https://example.invalid/next',
          musicians: [{ id: fixture.approvedNext.id, name: 'Approved Next', instrument: 'drums' }],
        },
      ],
    });
  });
});
