import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

let app: INestApplication;
let prisma: PrismaService;

export async function initializeApp(): Promise<INestApplication> {
  if (app) {
    return app;
  }

  app = await NestFactory.create(AppModule, {
    logger: ['error'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  prisma = app.get(PrismaService);
  await app.init();

  return app;
}

export async function closeApp(): Promise<void> {
  if (app) {
    await app.close();
    app = null;
  }
}

export async function getPrismaService(): Promise<PrismaService> {
  if (!prisma) {
    await initializeApp();
  }
  return prisma;
}

/**
 * Test data fixtures
 */
export const testFixtures = {
  /**
   * Create a test musician
   */
  async createMusician(data?: Partial<any>) {
    const prismaService = await getPrismaService();
    return prismaService.musician.create({
      data: {
        name: data?.name || 'Test Musician',
        email: data?.email || `musician-${Date.now()}@test.com`,
        instrument: data?.instrument || 'guitar',
        level: data?.level || 'INTERMEDIATE',
        isHost: data?.isHost ?? false,
        ...data,
      },
    });
  },

  /**
   * Create a test music/song
   */
  async createMusic(data?: Partial<any>) {
    const prismaService = await getPrismaService();
    return prismaService.music.create({
      data: {
        title: data?.title || `Test Song ${Date.now()}`,
        artist: data?.artist || 'Test Artist',
        duration: data?.duration || 180,
        ...data,
      },
    });
  },

  /**
   * Create a test jam session
   */
  async createJam(hostMusicianId?: string, data?: Partial<any>) {
    const prismaService = await getPrismaService();
    return prismaService.jam.create({
      data: {
        name: data?.name || `Test Jam ${Date.now()}`,
        description: data?.description || 'Test jam session',
        status: data?.status || 'ACTIVE',
        hostMusicianId: hostMusicianId,
        hostName: data?.hostName || 'Test Host',
        ...data,
      },
    });
  },

  /**
   * Create multiple scheduled songs for a jam
   */
  async createSchedules(jamId: string, musicIds: string[], data?: Partial<any>) {
    const prismaService = await getPrismaService();
    const schedules = [];

    for (let i = 0; i < musicIds.length; i++) {
      const schedule = await prismaService.schedule.create({
        data: {
          jamId,
          musicId: musicIds[i],
          order: i + 1,
          status: 'SCHEDULED',
          ...data,
        },
        include: {
          music: true,
        },
      });
      schedules.push(schedule);
    }

    return schedules;
  },

  /**
   * Create a registration (musician signup for a song)
   */
  async createRegistration(jamId: string, musicianId: string, data?: Partial<any>) {
    const prismaService = await getPrismaService();
    return prismaService.registration.create({
      data: {
        jamId,
        musicianId,
        status: data?.status || 'APPROVED',
        instrument: data?.instrument || 'guitar',
        ...data,
      },
    });
  },

  /**
   * Clean up all test data
   */
  async cleanup() {
    const prismaService = await getPrismaService();

    // Delete in correct order due to foreign keys
    await prismaService.playbackHistory.deleteMany({});
    await prismaService.registration.deleteMany({});
    await prismaService.schedule.deleteMany({});
    await prismaService.jamMusic.deleteMany({});
    await prismaService.jam.deleteMany({});
    await prismaService.music.deleteMany({});
    await prismaService.musician.deleteMany({});
  },
};

/**
 * Helper to create a complete test setup
 */
export async function setupTestData() {
  // Create test musicians
  const hostMusician = await testFixtures.createMusician({
    name: 'Test Host',
    isHost: true,
  });

  const musician2 = await testFixtures.createMusician({
    name: 'Musician 2',
  });

  // Create test songs
  const songs = await Promise.all([
    testFixtures.createMusic({ title: 'Song 1', artist: 'Artist 1' }),
    testFixtures.createMusic({ title: 'Song 2', artist: 'Artist 2' }),
    testFixtures.createMusic({ title: 'Song 3', artist: 'Artist 3' }),
    testFixtures.createMusic({ title: 'Song 4', artist: 'Artist 4' }),
  ]);

  // Create jam session
  const jam = await testFixtures.createJam(hostMusician.id);

  // Create schedules for the jam
  const schedules = await testFixtures.createSchedules(
    jam.id,
    songs.map((s) => s.id),
  );

  // Create registrations
  const registrations = await Promise.all([
    testFixtures.createRegistration(jam.id, hostMusician.id),
    testFixtures.createRegistration(jam.id, musician2.id),
  ]);

  return {
    hostMusician,
    musician2,
    songs,
    jam,
    schedules,
    registrations,
  };
}
