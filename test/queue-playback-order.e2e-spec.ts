import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeQueueOrder } from '../src/jam/queue-order';
import {
  closeApp,
  controlRequest,
  getPrismaService,
  initializeApp,
  setupTestData,
  testFixtures,
} from './test-helpers';

describe('Saved Schedule and playback independence (PostgreSQL)', () => {
  let app: INestApplication;
  let data: Awaited<ReturnType<typeof setupTestData>>;
  beforeAll(async () => {
    app = await initializeApp();
  });
  afterAll(closeApp);
  beforeEach(async () => {
    await testFixtures.cleanup();
    data = await setupTestData();
  });
  afterEach(() => testFixtures.cleanup());

  const state = async () =>
    (await request(app.getHttpServer()).get(`/jams/${data.jam.id}/live/state`).expect(200)).body;
  const control = (action: string, expectedStatus = 200, body?: object) =>
    controlRequest(data.hostMusician.token, action, data.jam.id, expectedStatus, body);
  const order = (indices: number[]) =>
    indices.map((index, position) => ({
      scheduleId: data.schedules[index].id,
      order: position + 1,
    }));
  const saved = async () =>
    (
      await getPrismaService().schedule.findMany({
        where: { jamId: data.jam.id },
        orderBy: { order: 'asc' },
      })
    ).map(({ id, order, status }) => ({ id, order, status }));

  it('preserves every position across play, pause and resume without reordering', async () => {
    const before = await saved();
    await control('start');
    await control('next');
    await control('pause');
    expect((await saved()).map(({ id, order }) => ({ id, order }))).toEqual(
      before.map(({ id, order }) => ({ id, order })),
    );
    expect((await state()).currentSong.id).toBe(data.schedules[1].id);
    expect((await control('resume')).body.currentScheduleId).toBe(data.schedules[1].id);
    expect((await saved())[0].status).toBe('COMPLETED');
  });

  it('supports play → pause → reorder → save → reload → play and leaves completed songs completed', async () => {
    await control('start');
    await control('next');
    await control('pause');
    const paused = await state();
    const updates = order([0, 3, 2, 1]);
    await control('reorder', 200, { updates, expectedRevision: paused.queueRevision });
    const reloaded = await state();
    expect(
      reloaded.allSongs.map((song: { id: string; order: number }) => ({
        scheduleId: song.id,
        order: song.order,
      })),
    ).toEqual(updates);
    expect(reloaded.currentSong).toMatchObject({
      id: data.schedules[1].id,
      order: 4,
      status: 'IN_PROGRESS',
    });
    expect(reloaded.resumeFromQueue).toBe(true);
    expect((await control('resume')).body.currentScheduleId).toBe(data.schedules[3].id);
    expect((await saved()).find((s) => s.id === data.schedules[0].id).status).toBe('COMPLETED');
    expect((await saved()).find((s) => s.id === data.schedules[1].id).status).toBe('SCHEDULED');
    expect((await saved()).map(({ id }) => id)).toEqual(
      [0, 3, 2, 1].map((index) => data.schedules[index].id),
    );
  });

  it('retains resume semantics on a save with no actual order change', async () => {
    await control('start');
    await control('next');
    await control('previous');
    await control('next');
    await control('pause');
    const paused = await state();
    await control('reorder', 200, {
      updates: order([0, 1, 2, 3]),
      expectedRevision: paused.queueRevision,
    });
    expect((await state()).resumeFromQueue).toBe(false);
    expect((await control('resume')).body.currentScheduleId).toBe(data.schedules[1].id);
  });

  it('protects only the playing position, allowing completed and upcoming songs to cross it', async () => {
    await control('start');
    await control('next');
    const playing = await state();
    await control('reorder', 409, {
      updates: order([1, 0, 2, 3]),
      expectedRevision: playing.queueRevision,
    });
    await control('reorder', 200, {
      updates: order([3, 1, 2, 0]),
      expectedRevision: playing.queueRevision,
    });
    expect((await state()).currentSong).toMatchObject({ id: data.schedules[1].id, order: 2 });
    expect((await saved())[3]).toMatchObject({ id: data.schedules[0].id, status: 'COMPLETED' });
  });

  it('leaves omitted positions unchanged and rejects collisions with them', async () => {
    await control('start');
    await control('reorder', 400, { updates: [{ scheduleId: data.schedules[2].id, order: 1 }] });
    await control('reorder', 200, {
      updates: [
        { scheduleId: data.schedules[2].id, order: 2 },
        { scheduleId: data.schedules[1].id, order: 3 },
      ],
    });
    expect((await saved()).map(({ id }) => id)).toEqual(
      [0, 2, 1, 3].map((index) => data.schedules[index].id),
    );
    expect((await state()).currentSong.order).toBe(1);
  });

  it('makes legacy IN_PROGRESS songs movable while stopped and playable afterward', async () => {
    await getPrismaService().schedule.update({
      where: { id: data.schedules[0].id },
      data: { status: 'IN_PROGRESS' },
    });
    const stopped = await state();
    expect(stopped.allSongs).toHaveLength(4);
    await control('reorder', 200, {
      updates: order([1, 2, 3, 0]),
      expectedRevision: stopped.queueRevision,
    });
    expect((await saved())[3]).toMatchObject({ id: data.schedules[0].id, status: 'SCHEDULED' });
    expect((await control('start')).body.currentScheduleId).toBe(data.schedules[1].id);
  });

  it('accepts only one of two conflicting simultaneous host reorders', async () => {
    const initial = await state();
    const reorder = (indices: number[]) =>
      request(app.getHttpServer())
        .post(`/jams/${data.jam.id}/control/reorder`)
        .set('Authorization', `Bearer ${data.hostMusician.token}`)
        .send({ updates: order(indices), expectedRevision: initial.queueRevision });
    const responses = await Promise.all([reorder([3, 2, 1, 0]), reorder([1, 0, 3, 2])]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(new Set((await saved()).map(({ order }) => order)).size).toBe(4);
  });

  it('serializes a simultaneous resume and paused reorder without moving an active song', async () => {
    await control('start');
    await control('pause');
    const paused = await state();
    const [reorder, resume] = await Promise.all([
      request(app.getHttpServer())
        .post(`/jams/${data.jam.id}/control/reorder`)
        .set('Authorization', `Bearer ${data.hostMusician.token}`)
        .send({ updates: order([1, 0, 2, 3]), expectedRevision: paused.queueRevision }),
      control('resume'),
    ]);
    expect(resume.status).toBe(200);
    expect([200, 409]).toContain(reorder.status);
    const live = await state();
    expect(live.currentSong.id).toBe(data.schedules[reorder.status === 200 ? 1 : 0].id);
    expect(
      live.allSongs.filter((s: { status: string }) => s.status === 'IN_PROGRESS'),
    ).toHaveLength(1);
  });

  it('rejects an order based on a snapshot from before another host paused playback', async () => {
    await control('start');
    const playing = await state();
    await control('pause');
    await control('reorder', 409, {
      updates: order([0, 2, 1, 3]),
      expectedRevision: playing.queueRevision,
    });
  });

  it('previews and applies history recovery once without changing playback or completed status', async () => {
    await control('start');
    await control('next');
    await control('pause');
    const db = getPrismaService();
    const schedules = await db.schedule.findMany({ where: { jamId: data.jam.id } });
    await db.$transaction(async (tx) => {
      await writeQueueOrder(tx, data.jam.id, order([2, 3, 0, 1]), schedules);
      await tx.playbackHistory.create({
        data: {
          jamId: data.jam.id,
          scheduleId: data.schedules[1].id,
          action: 'REORDER_QUEUE',
          metadata: {
            updates: [
              { scheduleId: data.schedules[2].id, order: 3 },
              { scheduleId: data.schedules[3].id, order: 4 },
            ],
          },
        },
      });
    });
    const run = (...args: string[]) =>
      promisify(execFile)(
        process.execPath,
        ['-r', 'ts-node/register', 'scripts/recover-queue-order.ts', data.jam.id, ...args],
        { cwd: process.cwd(), timeout: 20000 },
      );
    const displaced = await saved();
    expect((await run()).stdout).toContain('"apply": false');
    expect(await saved()).toEqual(displaced);
    await run('--apply');
    const restored = await saved();
    expect(restored.map(({ id }) => id)).toEqual(data.schedules.map(({ id }) => id));
    expect(restored[0].status).toBe('COMPLETED');
    expect((await state()).currentSong).toMatchObject({ id: data.schedules[1].id, order: 2 });
    expect((await state()).playbackState).toBe('PAUSED');
    expect((await run('--apply')).stdout).toContain('No unambiguous displaced order');
    expect(await saved()).toEqual(restored);
  }, 60000);
});
