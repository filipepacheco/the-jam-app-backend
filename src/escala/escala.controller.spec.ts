import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import * as request from 'supertest';
import { EscalaController } from './escala.controller';
import { EscalaService } from './escala.service';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseJwtStrategy } from '../auth/strategies/supabase-jwt.strategy';
import { TokenCacheService } from '../auth/services/token-cache.service';
import { JamManagementService } from '../jam/jam-management.service';

const jamId = '11111111-1111-4111-8111-111111111111';
const musicId = '22222222-2222-4222-8222-222222222222';

describe('Schedule creation permissions over HTTP', () => {
  let app: INestApplication;
  beforeEach(async () => {
    const db = {
      $queryRaw: async () => [{ id: jamId }],
      musician: {
        findUnique: async ({ where }: { where: { id?: string; supabaseUserId?: string } }) => ({
          id: where.id ?? where.supabaseUserId,
          isHost: (where.id ?? where.supabaseUserId) === 'host',
        }),
      },
      music: { findUnique: async () => ({ id: musicId }) },
      jam: {
        findUnique: async () => ({
          id: jamId,
          hostMusicianId: 'host',
          managementMode: 'OWNER_ONLY',
          deletedAt: null,
        }),
      },
      schedule: {
        findFirst: async () => null,
        create: async ({ data }: { data: object }) => ({ id: 'new', ...data }),
      },
    };
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [EscalaController],
      providers: [
        EscalaService,
        JamManagementService,
        SupabaseJwtStrategy,
        TokenCacheService,
        {
          provide: 'SUPABASE_SERVICE_CLIENT',
          useValue: {
            auth: {
              getUser: async (token: string) => ({
                data: {
                  user: ['ordinary', 'host'].includes(token)
                    ? { id: token, email: `${token}@example.invalid` }
                    : null,
                },
                error: null,
              }),
            },
          },
        },
        {
          provide: PrismaService,
          useValue: {
            ...db,
            $transaction: async (operation: (tx: typeof db) => Promise<unknown>) => operation(db),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1');
  });
  afterEach(async () => {
    await app?.close();
  });

  it('rejects a musician creating a song already in progress', async () => {
    await request(app.getHttpServer())
      .post('/escalas')
      .set('Authorization', 'Bearer ordinary')
      .send({ jamId, musicId, order: 1, status: 'IN_PROGRESS' })
      .expect(403);
  });
  it.each(['SCHEDULED', 'COMPLETED'])('rejects a musician requesting %s', async (status) => {
    await request(app.getHttpServer())
      .post('/escalas')
      .set('Authorization', 'Bearer ordinary')
      .send({ jamId, musicId, order: 1, status })
      .expect(403);
  });
  it('allows a musician to suggest a song', async () => {
    const response = await request(app.getHttpServer())
      .post('/escalas')
      .set('Authorization', 'Bearer ordinary')
      .send({ jamId, musicId, order: 1, status: 'SUGGESTED' })
      .expect(201);
    expect(response.body.status).toBe('SUGGESTED');
  });
  it('allows a host to schedule a song', async () => {
    const response = await request(app.getHttpServer())
      .post('/escalas')
      .set('Authorization', 'Bearer host')
      .send({ jamId, musicId, order: 1, status: 'SCHEDULED' })
      .expect(201);
    expect(response.body.status).toBe('SCHEDULED');
  });
  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .post('/escalas')
      .send({ jamId, musicId, order: 1 })
      .expect(401);
  });
});
