import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseJwtStrategy } from './strategies/supabase-jwt.strategy';
import { TokenCacheService } from './services/token-cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { FeedbackController } from '../feedback/feedback.controller';
import { FeedbackService } from '../feedback/feedback.service';

const start = 1800000000000;
function tokenWith(payload: object): string {
  return `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
}

describe('Authentication cache expiry over HTTP', () => {
  let app: INestApplication;
  let now: number;
  let providerAccepts: boolean;

  beforeEach(async () => {
    now = start;
    providerAccepts = true;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const feedback = {
      findMany: async () => [],
      create: async ({ data }: { data: object }) => ({
        id: 'feedback',
        ...data,
        createdAt: new Date(start),
      }),
    };
    const transactionClient = {
      $queryRaw: async () => [{ lock: '' }],
      feedback,
    };
    const module = await Test.createTestingModule({
      imports: [PassportModule, ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
      controllers: [AuthController, FeedbackController],
      providers: [
        AuthService,
        FeedbackService,
        SupabaseJwtStrategy,
        TokenCacheService,
        {
          provide: 'SUPABASE_SERVICE_CLIENT',
          useValue: {
            auth: {
              getUser: async () => ({
                data: {
                  user: providerAccepts ? { id: 'identity', email: 'user@example.invalid' } : null,
                },
                error: null,
              }),
            },
          },
        },
        {
          provide: PrismaService,
          useValue: {
            musician: {
              findUnique: async () => ({
                id: 'musician',
                supabaseUserId: 'identity',
                isHost: false,
              }),
            },
            feedback,
            $transaction: async (callback: (tx: typeof transactionClient) => unknown) =>
              callback(transactionClient),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
  });

  afterEach(async () => {
    await app?.close();
    jest.restoreAllMocks();
  });

  it('rejects a previously validated credential at its exact expiry', async () => {
    const token = tokenWith({ exp: 1800000001 });
    await request(app.getHttpServer()).get('/auth/me').auth(token, { type: 'bearer' }).expect(200);
    providerAccepts = false;
    now = start + 999;
    await request(app.getHttpServer()).get('/auth/me').auth(token, { type: 'bearer' }).expect(200);
    now = start + 1000;
    await request(app.getHttpServer()).get('/auth/me').auth(token, { type: 'bearer' }).expect(401);
  });

  it('clears the local validation cache while leaving provider sign-out to the client', async () => {
    const token = tokenWith({ exp: 1800003600 });
    await request(app.getHttpServer()).get('/auth/me').auth(token, { type: 'bearer' }).expect(200);
    providerAccepts = false;

    await request(app.getHttpServer())
      .post('/auth/logout')
      .auth(token, { type: 'bearer' })
      .expect(200)
      .expect(({ body }) => expect(body.providerSignOutRequired).toBe(true));

    await request(app.getHttpServer()).get('/auth/me').auth(token, { type: 'bearer' }).expect(401);
  });
  it('submits expired credentials as anonymous feedback', async () => {
    const token = tokenWith({ exp: 1800000001 });
    const identified = await request(app.getHttpServer())
      .post('/feedback')
      .auth(token, { type: 'bearer' })
      .send({ rating: 5 })
      .expect(201);
    expect(identified.body.musicianId).toBe('musician');
    providerAccepts = false;
    now = start + 1000;
    const anonymous = await request(app.getHttpServer())
      .post('/feedback')
      .auth(token, { type: 'bearer' })
      .send({ rating: 5 })
      .expect(201);
    expect(anonymous.body.musicianId).toBeNull();
  });

  it('requires provider validation again at the five-minute cache limit', async () => {
    const token = tokenWith({ exp: 1800003600 });
    await request(app.getHttpServer()).get('/auth/me').auth(token, { type: 'bearer' }).expect(200);
    providerAccepts = false;
    now = start + 299999;
    await request(app.getHttpServer()).get('/auth/me').auth(token, { type: 'bearer' }).expect(200);
    now = start + 300000;
    await request(app.getHttpServer()).get('/auth/me').auth(token, { type: 'bearer' }).expect(401);
  });

  it.each([
    ['missing expiry', tokenWith({})],
    ['string expiry', tokenWith({ exp: '1800003600' })],
    ['null expiry', tokenWith({ exp: null })],
    ['overflow expiry', tokenWith({ exp: Number.MAX_VALUE })],
    ['past expiry', tokenWith({ exp: 1799999999 })],
    ['non-JSON payload', 'header.bm90LWpzb24.signature'],
    ['non-JWT credential', 'opaque-credential'],
  ])('never reuses a provider result for %s', async (_label, token) => {
    await request(app.getHttpServer()).get('/auth/me').auth(token, { type: 'bearer' }).expect(200);
    providerAccepts = false;
    await request(app.getHttpServer()).get('/auth/me').auth(token, { type: 'bearer' }).expect(401);
  });

  it('does not authenticate an unvalidated token merely because its expiry is in the future', async () => {
    providerAccepts = false;
    const token = tokenWith({ exp: 1800003600 });
    await request(app.getHttpServer()).get('/auth/me').auth(token, { type: 'bearer' }).expect(401);
    const anonymous = await request(app.getHttpServer())
      .post('/feedback')
      .auth(token, { type: 'bearer' })
      .send({ rating: 5 })
      .expect(201);
    expect(anonymous.body.musicianId).toBeNull();
  });
});
