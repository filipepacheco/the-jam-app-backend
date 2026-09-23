import { PrismaClient, PlaybackAction } from '@prisma/client';
import { lockJamQueue } from '../src/escala/queue-lock';
import { writeQueueOrder } from '../src/jam/queue-order';
import { recoverLegacyOrder } from '../src/jam/queue-recovery';

const jamId = process.argv[2];
const apply = process.argv[3] === '--apply';
if (
  !jamId ||
  !/^[0-9a-f-]{36}$/i.test(jamId) ||
  process.argv.length > 4 ||
  (process.argv[3] && !apply)
) {
  throw new Error('Usage: npx ts-node scripts/recover-queue-order.ts <jam-id> [--apply]');
}
const prisma = new PrismaClient();
async function run() {
  await prisma.$transaction(async (tx) => {
    await lockJamQueue(tx, jamId);
    const jam = await tx.jam.findUniqueOrThrow({ where: { id: jamId } });
    if (jam.playbackState === 'PLAYING')
      throw new Error('Pause playback before recovering positions');
    const schedules = await tx.schedule.findMany({ where: { jamId }, orderBy: { order: 'asc' } });
    const history = await tx.playbackHistory.findFirst({
      where: { jamId, action: PlaybackAction.REORDER_QUEUE },
      orderBy: { timestamp: 'desc' },
    });
    const recovered = recoverLegacyOrder(schedules, history);
    if (!recovered) {
      console.log('No unambiguous displaced order found. Saved positions were left unchanged.');
      return;
    }
    console.log(
      JSON.stringify({ jamId, apply, historyId: history.id, positions: recovered }, null, 2),
    );
    if (!apply) return;
    await writeQueueOrder(tx, jamId, recovered, schedules);
    await tx.playbackHistory.create({
      data: {
        jamId,
        scheduleId: history.scheduleId,
        action: PlaybackAction.REORDER_QUEUE,
        metadata: {
          contractVersion: 2,
          recoveredFrom: history.id,
          updates: recovered.map(({ scheduleId, order }) => ({ scheduleId, order })),
          before: schedules.map(({ id, order }) => ({ scheduleId: id, order })),
        },
      },
    });
  });
}
run()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Recovery failed');
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
