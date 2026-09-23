import { createHash } from 'node:crypto';
import { Jam, Schedule } from '@prisma/client';

export type QueueJam = Pick<Jam, 'playbackState' | 'currentScheduleId' | 'resumeFromQueue'>;
export type QueueEntry = Pick<
  Schedule,
  'id' | 'order' | 'status' | 'startedAt' | 'completedAt' | 'pausedAt'
>;

/** An opaque compare-and-swap token; evaluate under the shared Jam row lock. */
export function queueRevision(jam: QueueJam, schedules: QueueEntry[]): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        jam.playbackState,
        jam.currentScheduleId,
        jam.resumeFromQueue,
        [...schedules]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((s) => [s.id, s.order, s.status, s.startedAt, s.completedAt, s.pausedAt]),
      ]),
    )
    .digest('hex');
}
