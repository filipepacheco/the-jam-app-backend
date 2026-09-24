import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JamManagementMode, JamStatus, RegistrationStatus, ScheduleStatus } from '@prisma/client';
import * as request from 'supertest';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import { JamManagementService } from '../jam/jam-management.service';
import { PrismaService } from '../prisma/prisma.service';
import { InscricaoController } from './inscricao.controller';
import { InscricaoService } from './inscricao.service';

const jamId = '11111111-1111-4111-8111-111111111111';
const scheduleId = '22222222-2222-4222-8222-222222222222';
const registrationId = '33333333-3333-4333-8333-333333333333';
const actors = {
  owner: { musicianId: '44444444-4444-4444-8444-444444444444', isHost: true },
  otherHost: { musicianId: '55555555-5555-4555-8555-555555555555', isHost: true },
  musician: { musicianId: '66666666-6666-4666-8666-666666666666', isHost: false },
};

describe('Host registration exceptions over HTTP', () => {
  let app: INestApplication;
  let jam: {
    id: string;
    hostMusicianId: string;
    managementMode: JamManagementMode;
    status: JamStatus;
    deletedAt: Date | null;
    autoApproveRegistrations: boolean;
  };
  let scheduleStatus: ScheduleStatus;
  let registration: {
    id: string;
    jamId: string;
    scheduleId: string;
    musicianId: string;
    instrument: string;
    status: RegistrationStatus;
  };
  const create = jest.fn();
  const update = jest.fn();

  beforeEach(async () => {
    jest.resetAllMocks();
    jam = {
      id: jamId,
      hostMusicianId: actors.owner.musicianId,
      managementMode: JamManagementMode.OWNER_ONLY,
      status: JamStatus.LIVE,
      deletedAt: null,
      autoApproveRegistrations: false,
    };
    scheduleStatus = ScheduleStatus.SCHEDULED;
    registration = {
      id: registrationId,
      jamId,
      scheduleId,
      musicianId: actors.musician.musicianId,
      instrument: 'guitars',
      status: RegistrationStatus.PENDING,
    };
    create.mockImplementation(async ({ data }: { data: object }) => ({
      id: registrationId,
      ...data,
    }));
    update.mockImplementation(async ({ data }: { data: object }) => ({ ...registration, ...data }));
    const module = await Test.createTestingModule({
      controllers: [InscricaoController],
      providers: [
        InscricaoService,
        JamManagementService,
        {
          provide: PrismaService,
          useValue: {
            musician: {
              findUnique: async ({ where }: { where: { id: string } }) =>
                Object.values(actors).find((actor) => actor.musicianId === where.id),
            },
            jam: { findUnique: async () => jam },
            schedule: {
              findUnique: async () => ({ id: scheduleId, jamId, jam, status: scheduleStatus }),
            },
            registration: {
              findFirst: async () => null,
              findUnique: async () => ({
                ...registration,
                jam,
                schedule: { status: scheduleStatus },
              }),
              create,
              update,
            },
          },
        },
      ],
    })
      .overrideGuard(SupabaseJwtGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest();
          const actor = Object.entries(actors).find(
            ([name]) => req.headers.authorization === `Bearer ${name}`,
          )?.[1];
          if (!actor) throw new UnauthorizedException();
          req.user = actor;
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1');
  });

  afterEach(async () => {
    await app?.close();
  });

  const apply = (actor: keyof typeof actors, musicianId?: string) =>
    request(app.getHttpServer())
      .post('/inscricoes')
      .auth(actor, { type: 'bearer' })
      .send({ scheduleId, instrument: 'guitar', ...(musicianId ? { musicianId } : {}) });

  it.each(['owner', 'otherHost'] as const)(
    'allows %s to register another musician when authorized',
    async (actor) => {
      if (actor === 'otherHost') jam.managementMode = JamManagementMode.SHARED_HOSTS;
      const response = await apply(actor, actors.musician.musicianId).expect(201);
      expect(response.body).toMatchObject({
        musicianId: actors.musician.musicianId,
        status: 'PENDING',
      });
    },
  );

  it.each(['musician', 'otherHost'] as const)(
    'rejects registration on behalf of others by unauthorized %s',
    async (actor) => {
      await apply(actor, actors.owner.musicianId).expect(403);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it.each([ScheduleStatus.IN_PROGRESS, ScheduleStatus.COMPLETED, ScheduleStatus.CANCELED])(
    'allows authorized hosts to create, approve and withdraw registrations on %s performances',
    async (status) => {
      scheduleStatus = status;
      await apply('owner', actors.musician.musicianId).expect(201);
      await request(app.getHttpServer())
        .patch(`/inscricoes/${registrationId}`)
        .auth('owner', { type: 'bearer' })
        .send({ status: 'APPROVED' })
        .expect(200);
      await request(app.getHttpServer())
        .delete(`/inscricoes/${registrationId}`)
        .auth('owner', { type: 'bearer' })
        .expect(200);
    },
  );

  it.each(['owner', 'otherHost'] as const)(
    'allows authorized %s to register and withdraw themselves after closure',
    async (actor) => {
      jam.managementMode = JamManagementMode.SHARED_HOSTS;
      scheduleStatus = ScheduleStatus.IN_PROGRESS;
      registration.musicianId = actors[actor].musicianId;
      await apply(actor).expect(201);
      await request(app.getHttpServer())
        .delete(`/inscricoes/${registrationId}`)
        .auth(actor, { type: 'bearer' })
        .expect(200);
    },
  );

  it('allows the jam owner to approve an existing registration after playback starts', async () => {
    scheduleStatus = ScheduleStatus.IN_PROGRESS;
    await request(app.getHttpServer())
      .patch(`/inscricoes/${registrationId}`)
      .auth('owner', { type: 'bearer' })
      .send({ status: 'APPROVED' })
      .expect(200);
  });

  it('allows the jam owner to withdraw an existing registration after playback starts', async () => {
    scheduleStatus = ScheduleStatus.IN_PROGRESS;
    await request(app.getHttpServer())
      .delete(`/inscricoes/${registrationId}`)
      .auth('owner', { type: 'bearer' })
      .expect(200);
  });

  it.each(['musician', 'otherHost'] as const)(
    'keeps the closure restriction for %s without jam management permission',
    async (actor) => {
      scheduleStatus = ScheduleStatus.IN_PROGRESS;
      registration.musicianId = actors[actor].musicianId;
      await apply(actor).expect(400);
      await request(app.getHttpServer())
        .delete(`/inscricoes/${registrationId}`)
        .auth(actor, { type: 'bearer' })
        .expect(400);
      expect(create).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    },
  );

  it('does not grant ordinary musicians host exceptions in shared jams', async () => {
    jam.managementMode = JamManagementMode.SHARED_HOSTS;
    scheduleStatus = ScheduleStatus.IN_PROGRESS;
    await apply('musician', actors.owner.musicianId).expect(403);
    await apply('musician').expect(400);
    await request(app.getHttpServer())
      .patch(`/inscricoes/${registrationId}`)
      .auth('musician', { type: 'bearer' })
      .send({ status: 'APPROVED' })
      .expect(403);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps edits and withdrawals owner-only until host sharing is enabled', async () => {
    scheduleStatus = ScheduleStatus.IN_PROGRESS;
    await request(app.getHttpServer())
      .patch(`/inscricoes/${registrationId}`)
      .auth('otherHost', { type: 'bearer' })
      .send({ status: 'APPROVED' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/inscricoes/${registrationId}`)
      .auth('otherHost', { type: 'bearer' })
      .expect(403);
    jam.managementMode = JamManagementMode.SHARED_HOSTS;
    await request(app.getHttpServer())
      .patch(`/inscricoes/${registrationId}`)
      .auth('otherHost', { type: 'bearer' })
      .send({ status: 'APPROVED' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/inscricoes/${registrationId}`)
      .auth('otherHost', { type: 'bearer' })
      .expect(200);
  });

  it.each([JamStatus.INACTIVE, JamStatus.FINISHED])(
    'preserves the %s jam restriction for hosts',
    async (status) => {
      jam.status = status;
      await apply('owner').expect(400);
      await request(app.getHttpServer())
        .patch(`/inscricoes/${registrationId}`)
        .auth('owner', { type: 'bearer' })
        .send({ status: 'APPROVED' })
        .expect(400);
      await request(app.getHttpServer())
        .delete(`/inscricoes/${registrationId}`)
        .auth('owner', { type: 'bearer' })
        .expect(400);
    },
  );

  it('preserves deleted-jam protections for hosts', async () => {
    jam.deletedAt = new Date();
    await apply('owner').expect(404);
    await request(app.getHttpServer())
      .patch(`/inscricoes/${registrationId}`)
      .auth('owner', { type: 'bearer' })
      .send({ status: 'APPROVED' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/inscricoes/${registrationId}`)
      .auth('owner', { type: 'bearer' })
      .expect(404);
  });

  it('preserves self-registration for hosts of unrelated jams and redundant self IDs', async () => {
    await apply('otherHost').expect(201);
    await apply('musician', actors.musician.musicianId).expect(201);
  });
});
