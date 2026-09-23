import { recoverLegacyOrder } from './queue-recovery';

const timestamp = new Date('2026-09-22T20:00:00Z');
const schedules = ['next', 'later', 'done', 'paused'].map((id, index) => ({
  id,
  order: index + 1,
  createdAt: new Date('2026-09-21T20:00:00Z'),
}));
const history = {
  scheduleId: 'paused',
  timestamp,
  metadata: {
    updates: [
      { scheduleId: 'next', order: 3 },
      { scheduleId: 'later', order: 4 },
    ],
  },
};

describe('legacy order recovery', () => {
  it('restores absolute request positions and the preserved relative order of omitted Performances', () => {
    expect(recoverLegacyOrder(schedules, history)).toEqual([
      { scheduleId: 'done', order: 1 },
      { scheduleId: 'paused', order: 2 },
      { scheduleId: 'next', order: 3 },
      { scheduleId: 'later', order: 4 },
    ]);
  });
  it('does not invent positions for missing or ambiguous history', () => {
    expect(recoverLegacyOrder(schedules, null)).toBeNull();
    expect(
      recoverLegacyOrder(schedules, {
        ...history,
        metadata: { updates: [{ scheduleId: 'next', order: 1 }] },
      }),
    ).toBeNull();
    expect(
      recoverLegacyOrder(schedules, {
        ...history,
        metadata: { ...history.metadata, contractVersion: 2 },
      }),
    ).toBeNull();
    expect(
      recoverLegacyOrder(
        [...schedules].reverse().map((s, i) => ({ ...s, order: i + 1 })),
        history,
      ),
    ).toBeNull();
    expect(
      recoverLegacyOrder(
        [...schedules, { id: 'new', order: 5, createdAt: new Date('2026-09-23') }],
        history,
      ),
    ).toBeNull();
  });
});
