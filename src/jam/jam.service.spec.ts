import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import * as request from 'supertest';
import { JamService } from './jam.service';
import { JamController } from './jam.controller';
import { JamPlaybackService } from './jam-playback.service';
import { JamLiveStateService } from './jam-live-state.service';
import { JamManagementService } from './jam-management.service';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseJwtStrategy } from '../auth/strategies/supabase-jwt.strategy';
import { TokenCacheService } from '../auth/services/token-cache.service';

const jamId = '11111111-1111-4111-8111-111111111111';

describe('Jam editing permissions over HTTP', () => {
  it.each([
    {
      name: 'an ordinary musician editing an ownerless jam',
      owner: null,
      actor: 'ordinary',
      expected: 403,
    },
    {
      name: 'another musician editing an owned jam',
      owner: 'owner',
      actor: 'ordinary',
      expected: 403,
    },
    { name: 'an unauthenticated caller', owner: null, actor: null, expected: 401 },
    { name: 'the jam owner', owner: 'owner', actor: 'owner', expected: 200 },
    { name: 'an existing global host', owner: null, actor: 'host', expected: 200 },
  ])('handles $name', async ({ owner, actor, expected }) => {
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [JamController],
      providers: [
        JamService,
        JamPlaybackService,
        JamLiveStateService,
        JamManagementService,
        ConfigService,
        SupabaseJwtStrategy,
        TokenCacheService,
        {
          provide: 'SUPABASE_SERVICE_CLIENT',
          useValue: {
            auth: {
              getUser: async (token: string) => ({
                data: { user: { id: token, email: `${token}@example.invalid` } },
                error: null,
              }),
            },
          },
        },
        {
          provide: PrismaService,
          useValue: {
            musician: {
              findUnique: async ({
                where,
              }: {
                where: { id?: string; supabaseUserId?: string };
              }) => ({
                id: where.id ?? where.supabaseUserId,
                isHost: (where.id ?? where.supabaseUserId) === 'host',
              }),
            },
            jam: {
              findFirst: async () => ({ id: jamId, hostMusicianId: owner }),
              update: async ({ data }: { data: object }) => ({ id: jamId, ...data }),
            },
          },
        },
      ],
    }).compile();
    const app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    try {
      await app.listen(0, '127.0.0.1');
      const call = request(app.getHttpServer())
        .patch(`/jams/${jamId}`)
        .send({ description: 'Changed' });
      const authenticatedCall = actor ? call.set('Authorization', `Bearer ${actor}`) : call;
      const response = await authenticatedCall.expect(expected);
      if (expected === 200) expect(response.body.description).toBe('Changed');
    } finally {
      await app.close();
    }
  });
});

describe('Jam list musician count', () => {
  it('keeps the registration total separate from distinct active musicians', async () => {
    const prismaMock = {
      jam: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'jam-1', _count: { registrations: 5, schedules: 2, jamMusics: 1 } },
          { id: 'jam-2', _count: { registrations: 0, schedules: 0, jamMusics: 0 } },
        ]),
        count: jest.fn().mockResolvedValue(2),
      },
      registration: {
        groupBy: jest.fn().mockResolvedValue([
          { jamId: 'jam-1', musicianId: 'musician-1' },
          { jamId: 'jam-1', musicianId: 'musician-2' },
        ]),
      },
    };
    const service = new JamService(prismaMock as unknown as PrismaService, {} as ConfigService);

    const result = await service.findAll();

    expect(result.data[0]).toMatchObject({
      registeredMusicianCount: 2,
      _count: { registrations: 5 },
    });
    expect(result.data[1]).toMatchObject({ registeredMusicianCount: 0 });
    expect(prismaMock.jam.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: expect.objectContaining({ location: true }) }),
    );
    expect(prismaMock.registration.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['jamId', 'musicianId'],
        where: {
          jamId: { in: ['jam-1', 'jam-2'] },
          status: { in: ['PENDING', 'APPROVED'] },
        },
      }),
    );
  });
});

describe('Public Jam detail', () => {
  it('selects the saved host contact and owner profile ID for UUID and slug routes', async () => {
    const prismaMock = {
      jam: {
        findFirst: jest.fn().mockResolvedValue({
          id: jamId,
          hostName: 'Ana',
          hostContact: 'ana@example.test',
          hostMusicianId: 'host-1',
          schedules: [],
        }),
      },
    };
    const service = new JamService(prismaMock as unknown as PrismaService, {} as ConfigService);

    const byId = await service.findOne(jamId);
    const bySlug = await service.findByIdentifier('ana-jam');

    expect(byId).toMatchObject({ hostContact: 'ana@example.test', hostMusicianId: 'host-1' });
    expect(bySlug).toMatchObject({ hostContact: 'ana@example.test', hostMusicianId: 'host-1' });
    for (const [call] of prismaMock.jam.findFirst.mock.calls) {
      expect(call.select).toMatchObject({ hostContact: true, hostMusicianId: true });
    }
  });
});
