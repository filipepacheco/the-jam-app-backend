import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Serializes queue writes for one jam. Every queue writer must take this lock
 * before allocating or renumbering positions.
 */
export async function lockJamQueue(tx: Prisma.TransactionClient, jamId: string): Promise<void> {
  const lockedJams = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id"
    FROM "jams"
    WHERE "id" = ${jamId} AND "excluido_em" IS NULL
    FOR NO KEY UPDATE
  `);

  if (lockedJams.length === 0) {
    throw new NotFoundException('Jam not found');
  }
}
