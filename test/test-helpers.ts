import './require-test-database.cjs';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/all-exceptions.filter';
import { configureTrustedProxy } from '../src/common/client-identity';

// The runner creates this database; repeat the guard immediately before deletion.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertTestDatabase } = require('../scripts/test-database.cjs');
let app: INestApplication | null = null;
let prisma: PrismaService | null = null;
const identities = new Map<string, { id: string; email: string }>();

export async function initializeApp(): Promise<INestApplication> {
  assertTestDatabase();
  if (app) return app;
  const candidate = await createTestApp();
  prisma = candidate.get(PrismaService);
  app = candidate;
  return app;
}

export async function createTestApp(): Promise<INestApplication> {
  assertTestDatabase();
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider('SUPABASE_SERVICE_CLIENT')
    .useValue({
      auth: {
        getUser: async (token: string) => ({
          data: { user: identities.get(token) ?? null },
          error: identities.has(token) ? null : new Error('Invalid test token'),
        }),
      },
    })
    .compile();
  const candidate = module.createNestApplication({ logger: false });
  configureTrustedProxy(candidate, 1);
  candidate.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  candidate.useGlobalFilters(new AllExceptionsFilter());
  try {
    await candidate.init();
    return candidate;
  } catch (error) {
    await candidate.close();
    throw error;
  }
}

export async function closeApp(): Promise<void> {
  if (app) await app.close();
  app = null;
  prisma = null;
  identities.clear();
}

export function getPrismaService(): PrismaService {
  if (!prisma) throw new Error('Test app has not initialized');
  return prisma;
}

export const testFixtures = {
  async getFeedbackCount() {
    return getPrismaService().feedback.count();
  },
  async createMusician(data: Partial<Prisma.MusicianUncheckedCreateInput> = {}) {
    const id = randomUUID();
    const musician = await getPrismaService().musician.create({
      data: {
        name: 'Test Musician',
        email: `${id}@example.invalid`,
        supabaseUserId: id,
        instrument: 'guitar',
        level: 'INTERMEDIATE',
        isHost: false,
        ...data,
      },
    });
    const token = `test-${id}`;
    identities.set(token, { id: musician.supabaseUserId, email: musician.email });
    return { ...musician, token };
  },
  async createMusic(data: Partial<Prisma.MusicUncheckedCreateInput> = {}) {
    return getPrismaService().music.create({
      data: {
        title: `Test Song ${randomUUID()}`,
        artist: 'Test Artist',
        duration: 180,
        ...data,
      },
    });
  },
  async createJam(hostMusicianId?: string, data: Partial<Prisma.JamUncheckedCreateInput> = {}) {
    return getPrismaService().jam.create({
      data: { name: 'Test Jam', hostMusicianId, status: 'ACTIVE', ...data },
    });
  },
  async createSchedules(jamId: string, musicIds: string[]) {
    return Promise.all(
      musicIds.map((musicId, i) =>
        getPrismaService().schedule.create({
          data: { jamId, musicId, order: i + 1, status: 'SCHEDULED' },
        }),
      ),
    );
  },
  async cleanup() {
    assertTestDatabase();
    if (!prisma) return;
    await prisma.playbackHistory.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.jamMusic.deleteMany();
    await prisma.jam.deleteMany();
    await prisma.music.deleteMany();
    await prisma.feedback.deleteMany();
    await prisma.musician.deleteMany();
    identities.clear();
  },
};

export function controlRequest(
  token: string,
  action: string,
  jamId: string,
  expectedStatus = 200,
  body?: object,
) {
  return request(app.getHttpServer())
    .post(`/jams/${jamId}/control/${action}`)
    .set('Authorization', `Bearer ${token}`)
    .send(body)
    .expect(expectedStatus);
}

export async function setupTestData() {
  const hostMusician = await testFixtures.createMusician({ name: 'Test Host', isHost: true });
  const musician = await testFixtures.createMusician();
  const songs = await Promise.all(
    [1, 2, 3, 4].map((n) => testFixtures.createMusic({ title: `Song ${n}` })),
  );
  const jam = await testFixtures.createJam(hostMusician.id);
  const schedules = await testFixtures.createSchedules(
    jam.id,
    songs.map((s) => s.id),
  );
  return { hostMusician, musician, songs, jam, schedules };
}
