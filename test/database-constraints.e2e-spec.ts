import {
  closeApp,
  getPrismaService,
  initializeApp,
  setupTestData,
  testFixtures,
} from './test-helpers';

describe('Database invariant backstops (disposable PostgreSQL)', () => {
  let data: Awaited<ReturnType<typeof setupTestData>>;

  beforeAll(async () => {
    await initializeApp();
  });

  beforeEach(async () => {
    await testFixtures.cleanup();
    data = await setupTestData();
  });

  afterAll(async () => {
    await testFixtures.cleanup();
    await closeApp();
  });

  it('rejects duplicate queue positions inside one jam', async () => {
    await expect(
      getPrismaService().schedule.create({
        data: {
          jamId: data.jam.id,
          musicId: data.songs[1].id,
          order: data.schedules[0].order,
          status: 'SCHEDULED',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects duplicate musician, slot and instrument registration identities', async () => {
    const identity = {
      jamId: data.jam.id,
      musicianId: data.musician.id,
      scheduleId: data.schedules[0].id,
      instrument: 'guitars',
    };
    await getPrismaService().registration.create({ data: identity });

    await expect(getPrismaService().registration.create({ data: identity })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('rejects a second in-progress schedule for one jam', async () => {
    await getPrismaService().schedule.update({
      where: { id: data.schedules[0].id },
      data: { status: 'IN_PROGRESS' },
    });

    await expect(
      getPrismaService().schedule.update({
        where: { id: data.schedules[1].id },
        data: { status: 'IN_PROGRESS' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects duplicate Spotify catalog identities', async () => {
    const link = 'https://open.spotify.com/track/database-constraint';
    await getPrismaService().music.update({
      where: { id: data.songs[0].id },
      data: { link },
    });

    await expect(
      getPrismaService().music.update({
        where: { id: data.songs[1].id },
        data: { link },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects duplicate new-event import keys for one host', async () => {
    const spotifyImportKey = 'database-constraint-import-key';
    await testFixtures.createJam(data.hostMusician.id, { spotifyImportKey });

    await expect(
      testFixtures.createJam(data.hostMusician.id, { spotifyImportKey }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
