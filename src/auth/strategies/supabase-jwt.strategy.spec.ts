import { UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SupabaseJwtStrategy } from './supabase-jwt.strategy';

describe('SupabaseJwtStrategy identity reconciliation', () => {
  const requestFor = (token = 'provider-token') =>
    ({ headers: { authorization: `Bearer ${token}` } }) as never;

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
    const musician = { id: 'musician', supabaseUserId: 'stable-subject', isHost: true };
    const findUnique = jest.fn().mockResolvedValue(musician);
    const strategy = new SupabaseJwtStrategy(
      { musician: { findUnique } } as never,
      {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'stable-subject', email: 'new-email@example.invalid' } },
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
