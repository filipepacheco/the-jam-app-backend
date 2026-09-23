import { UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SupabaseJwtStrategy } from './supabase-jwt.strategy';

describe('SupabaseJwtStrategy identity reconciliation', () => {
  const requestFor = (token = 'provider-token') =>
    ({ headers: { authorization: `Bearer ${token}` } }) as never;

  it('creates a Google musician with the provider full name instead of an email-derived name', async () => {
    const create = jest
      .fn()
      .mockImplementation(({ data }) =>
        Promise.resolve({ id: 'new-musician', isHost: false, ...data }),
      );
    const strategy = new SupabaseJwtStrategy(
      { musician: { findUnique: jest.fn().mockResolvedValue(null), create } } as never,
      {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: {
              user: {
                id: 'google-subject',
                email: 'alex.example@example.invalid',
                app_metadata: { provider: 'google' },
                user_metadata: { full_name: 'Alex Example', name: 'Alex Example' },
              },
            },
            error: null,
          }),
        },
      } as never,
      { get: jest.fn().mockReturnValue(null), set: jest.fn() } as never,
    );

    await strategy.validate(requestFor());

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Alex Example',
        email: 'alex.example@example.invalid',
      }),
    });
  });

  it('refuses a new provider subject that claims an existing email without changing that musician', async () => {
    const existingMusician = {
      id: 'existing-musician',
      supabaseUserId: 'original-subject',
      email: 'shared@example.invalid',
      isHost: false,
    };
    const prisma = {
      musician: {
        findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existingMusician),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    const strategy = new SupabaseJwtStrategy(
      prisma as never,
      {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'different-subject', email: existingMusician.email } },
            error: null,
          }),
        },
      } as never,
      { get: jest.fn().mockReturnValue(null), set: jest.fn() } as never,
    );

    await expect(strategy.validate(requestFor())).rejects.toEqual(
      new UnauthorizedException('Unable to authenticate account'),
    );
    expect(prisma.musician.update).not.toHaveBeenCalled();
    expect(prisma.musician.create).not.toHaveBeenCalled();
    expect(existingMusician.supabaseUserId).toBe('original-subject');
  });

  it('continues to authenticate the same provider subject after its email changes', async () => {
    const musician = {
      id: 'musician',
      supabaseUserId: 'stable-subject',
      name: 'Stage Alex',
      isHost: true,
    };
    const findUnique = jest.fn().mockResolvedValue(musician);
    const update = jest.fn();
    const strategy = new SupabaseJwtStrategy(
      { musician: { findUnique, update } } as never,
      {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: {
              user: {
                id: 'stable-subject',
                email: 'new-email@example.invalid',
                user_metadata: { full_name: 'Alex Example' },
              },
            },
            error: null,
          }),
        },
      } as never,
      { get: jest.fn().mockReturnValue(null), set: jest.fn() } as never,
    );

    await expect(strategy.validate(requestFor())).resolves.toEqual({
      musicianId: 'musician',
      supabaseUserId: 'stable-subject',
      isHost: true,
    });
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith({ where: { supabaseUserId: 'stable-subject' } });
    expect(update).not.toHaveBeenCalled();
    expect(musician.name).toBe('Stage Alex');
  });

  it('recovers a concurrent first login when another request creates the same provider subject', async () => {
    const createdByConcurrentRequest = {
      id: 'musician',
      supabaseUserId: 'new-subject',
      isHost: false,
    };
    const uniqueConflict = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: Prisma.prismaVersion.client,
    });
    const prisma = {
      musician: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdByConcurrentRequest),
        create: jest.fn().mockRejectedValue(uniqueConflict),
      },
    };
    const strategy = new SupabaseJwtStrategy(
      prisma as never,
      {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'new-subject', email: 'new@example.invalid' } },
            error: null,
          }),
        },
      } as never,
      { get: jest.fn().mockReturnValue(null), set: jest.fn() } as never,
    );

    await expect(strategy.validate(requestFor())).resolves.toEqual({
      musicianId: 'musician',
      supabaseUserId: 'new-subject',
      isHost: false,
    });
  });
});
