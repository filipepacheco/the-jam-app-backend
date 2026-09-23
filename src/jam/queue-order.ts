import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface OrderUpdate {
  scheduleId: string;
  order: number;
}

/** Updates only supplied positions; callers validate collisions before writing. */
export async function writeQueueOrder(
  tx: Prisma.TransactionClient,
  jamId: string,
  updates: OrderUpdate[],
  schedules: { id: string; order: number }[],
): Promise<void> {
  if (!updates.length) return;
  const occupied = new Set([...schedules.map((s) => s.order), ...updates.map((u) => u.order)]);
  let temporary = -2_147_483_648;
  const temporaryCases = updates.map(({ scheduleId }) => {
    while (occupied.has(temporary)) temporary++;
    if (temporary > 2_147_483_647)
      throw new BadRequestException('No temporary queue positions available');
    return Prisma.sql`WHEN "id" = ${scheduleId} THEN ${temporary++}`;
  });
  const ids = updates.map((u) => u.scheduleId);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "escalas" SET "ordem" = CASE ${Prisma.join(temporaryCases, ' ')} END
    WHERE "jamId" = ${jamId} AND "id" IN (${Prisma.join(ids)})
  `);
  const cases = updates.map(
    ({ scheduleId, order }) => Prisma.sql`WHEN "id" = ${scheduleId} THEN ${order}`,
  );
  await tx.$executeRaw(Prisma.sql`
    UPDATE "escalas" SET "ordem" = CASE ${Prisma.join(cases, ' ')} END, "atualizado_em" = NOW()
    WHERE "jamId" = ${jamId} AND "id" IN (${Prisma.join(ids)})
  `);
}
