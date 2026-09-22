import { RegistrationStatus } from '@prisma/client';
import { InscricaoService } from './inscricao.service';
import { PrismaService } from '../prisma/prisma.service';
import { JamManagementService } from '../jam/jam-management.service';

describe('InscricaoService', () => {
  const prismaMock = {
    schedule: { findUnique: jest.fn() },
    registration: { findFirst: jest.fn(), create: jest.fn() },
  };
  const prisma = prismaMock as unknown as PrismaService;
  const jamManagementService = {} as JamManagementService;

  let service: InscricaoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InscricaoService(prisma, jamManagementService);
    prismaMock.registration.findFirst.mockResolvedValue(null);
    prismaMock.registration.create.mockResolvedValue({ id: 'registration-1' });
  });

  const schedule = (autoApproveRegistrations: boolean, music = {}) => ({
    id: 'schedule-1',
    jamId: 'jam-1',
    jam: {
      id: 'jam-1',
      autoApproveRegistrations,
      deletedAt: null,
      status: 'ACTIVE',
    },
    status: 'SCHEDULED',
    music,
  });

  it('keeps new registrations pending when auto-approval is disabled', async () => {
    prismaMock.schedule.findUnique.mockResolvedValue(schedule(false));

    await service.create({ scheduleId: 'schedule-1', instrument: 'guitar' }, 'musician-1');

    expect(prismaMock.registration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: RegistrationStatus.PENDING }),
      }),
    );
  });

  it('approves new registrations when the jam enables auto-approval', async () => {
    prismaMock.schedule.findUnique.mockResolvedValue(schedule(true));

    await service.create({ scheduleId: 'schedule-1', instrument: 'guitar' }, 'musician-1');

    expect(prismaMock.registration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: RegistrationStatus.APPROVED }),
      }),
    );
  });

  it('does not impose capacity based on authored music requirements', async () => {
    prismaMock.schedule.findUnique.mockResolvedValue(
      schedule(false, {
        neededDrums: 0,
        neededGuitars: 0,
        neededVocals: 0,
        neededBass: 0,
        neededKeys: 0,
      }),
    );

    await expect(
      service.create({ scheduleId: 'schedule-1', instrument: 'piano' }, 'musician-1'),
    ).resolves.toEqual({ id: 'registration-1' });
    expect(prismaMock.registration.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.registration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          instrument: 'keys',
          status: RegistrationStatus.PENDING,
        }),
      }),
    );
  });
});
