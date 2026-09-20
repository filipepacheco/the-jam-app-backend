// Audit-only probes: actual compiled domain services, in-memory persistence adapters.
// No credentials, external database, HTTP requests, or application writes.
const assert = require('node:assert/strict');
const path = require('node:path');
const root = process.argv[2] || process.cwd();
const { JamPlaybackService } = require(path.join(root, 'dist/src/jam/jam-playback.service.js'));
const { EscalaService } = require(path.join(root, 'dist/src/escala/escala.service.js'));
const { JamService } = require(path.join(root, 'dist/src/jam/jam.service.js'));

async function main() {
  const jam = { id: 'j', status: 'LIVE', playbackState: 'PAUSED', currentScheduleId: 'a' };
  const schedules = [
    { id: 'a', jamId: 'j', order: 1, status: 'IN_PROGRESS' },
    { id: 'b', jamId: 'j', order: 2, status: 'SCHEDULED' },
  ];
  const prisma = {
    jam: { findUnique: async () => ({ ...jam }), update: async ({ data }) => Object.assign(jam, data) },
    schedule: {
      findFirst: async ({ where }) => schedules.find(s => s.status === where.status),
      findUnique: async ({ where }) => schedules.find(s => s.id === where.id),
      update: async ({ where, data }) => Object.assign(schedules.find(s => s.id === where.id), data),
    },
    playbackHistory: { create: async () => ({}) },
  };
  prisma.$transaction = async fn => fn(prisma);
  const playback = new JamPlaybackService(prisma);
  await playback.startJam('j');
  assert.equal(schedules.filter(s => s.status === 'IN_PROGRESS').length, 2);
  assert.equal(jam.currentScheduleId, 'b');
  console.log('CONFIRMED paused -> start writes a second IN_PROGRESS without clearing the first; pointer=b.');
  console.log('LIMITATION adapter has no DB constraints: a deployed partial unique index would reject this invalid write instead.');
  await playback.nextSong('j');
  assert.equal(jam.status, 'LIVE');
  assert.equal(jam.playbackState, 'STOPPED');
  assert.equal(jam.currentScheduleId, null);
  await assert.rejects(() => playback.stopJam('j'), /Jam is already stopped/);
  console.log('CONFIRMED queue exhausted -> LIVE / STOPPED / null; stop rejects "Jam is already stopped".');

  const rows = [{ order: 1 }, { order: 3 }];
  const db = {
    music: { findUnique: async () => ({ id: 'm' }) },
    jam: { findUnique: async () => ({ id: 'j' }) },
    schedule: { count: async () => rows.length, create: async ({ data }) => { rows.push(data); return data; } },
  };
  db.$transaction = async fn => fn(db);
  const created = await new EscalaService(db).create({ jamId: 'j', musicId: 'm', order: 99, status: 'IN_PROGRESS' });
  assert.deepEqual(rows.map(s => s.order), [1, 3, 3]);
  assert.equal(created.status, 'IN_PROGRESS');
  console.log('CONFIRMED schedule create after deleting order 2 computes duplicate orders [1,3,3] and accepts IN_PROGRESS.');
  console.log('LIMITATION adapter has no DB constraints: deployed order uniqueness would reject the create instead. Controller user-role allowance verified separately in source.');

  const ownerless = { id: 'j', hostMusicianId: null, name: 'Original', shortCode: 'ABC123' };
  const jamDb = { jam: { findFirst: async () => ownerless, update: async ({ data }) => ({ ...ownerless, ...data }) } };
  const updated = await new JamService(jamDb, {}).update('j', { description: 'Changed by ordinary user' }, 'ordinary-user', false);
  assert.equal(updated.description, 'Changed by ordinary user');
  console.log('CONFIRMED ordinary user can update ownerless jam through JamService.update.');
  console.log('All audit probes passed. These prove service decisions, not real PostgreSQL isolation, index presence, or HTTP guard behavior.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
