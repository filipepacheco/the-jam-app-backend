import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('Operational health HTTP contract', () => {
  let app: INestApplication;
  const prisma = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });

  afterEach(() => app.close());

  it('reports process liveness without depending on database readiness', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database unavailable'));

    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toMatchObject({ status: 'ok', uptime: expect.any(Number) });
    expect(response.body.timestamp).toEqual(expect.any(String));
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('reports readiness only when PostgreSQL is available', async () => {
    prisma.$queryRaw.mockResolvedValue([{ value: 1 }]);

    const response = await request(app.getHttpServer()).get('/ready').expect(200);
    expect(response.body).toMatchObject({
      status: 'ready',
      database: { status: 'connected', latency: expect.any(Number) },
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  it('returns 503 when PostgreSQL is unavailable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database unavailable'));

    await request(app.getHttpServer())
      .get('/ready')
      .expect(503)
      .expect(({ body }) => expect(body.message).toBe('Database is not ready'));
  });
});
