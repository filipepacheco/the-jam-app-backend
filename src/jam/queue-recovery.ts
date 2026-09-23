import { Prisma } from '@prisma/client';
import { OrderUpdate } from './queue-order';

/**
 * Recover only the recognizable legacy frontend payload: absolute positions
 * with a gap, with the current Performance omitted, and the exact faulty
 * requested-prefix / omitted-suffix result still saved. Ambiguous histories
 * return null instead of inventing an original order.
 */
export function recoverLegacyOrder(
  schedules: { id: string; order: number; createdAt: Date }[],
  history: { scheduleId: string; timestamp: Date; metadata: Prisma.JsonValue } | null,
): OrderUpdate[] | null {
  if (
    !history ||
    !history.metadata ||
    typeof history.metadata !== 'object' ||
    Array.isArray(history.metadata)
  )
    return null;
  const metadata = history.metadata;
  if (metadata.contractVersion || !Array.isArray(metadata.updates)) return null;
  const updates: OrderUpdate[] = [];
  for (const value of metadata.updates) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      typeof value.scheduleId !== 'string' ||
      typeof value.order !== 'number' ||
      !Number.isInteger(value.order)
    )
      return null;
    updates.push({ scheduleId: value.scheduleId, order: value.order });
  }
  const ordered = [...schedules].sort((a, b) => a.order - b.order);
  const requested = [...updates].sort((a, b) => a.order - b.order);
  const ids = new Set(requested.map((u) => u.scheduleId));
  const positions = new Set(requested.map((u) => u.order));
  if (
    !requested.length ||
    ids.has(history.scheduleId) ||
    !ordered.some((s) => s.id === history.scheduleId) ||
    ids.size !== requested.length ||
    positions.size !== requested.length ||
    requested.every((u, index) => u.order === index + 1) ||
    requested.some((u) => u.order < 1 || u.order > ordered.length) ||
    ordered.some((s, index) => s.order !== index + 1 || s.createdAt > history.timestamp) ||
    requested.some((u, index) => ordered[index]?.id !== u.scheduleId)
  )
    return null;
  const gaps = ordered.map((_, index) => index + 1).filter((order) => !positions.has(order));
  const omitted = ordered.filter((s) => !ids.has(s.id));
  return [
    ...requested,
    ...omitted.map((s, index) => ({ scheduleId: s.id, order: gaps[index] })),
  ].sort((a, b) => a.order - b.order);
}
