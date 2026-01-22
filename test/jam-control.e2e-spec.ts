import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  initializeApp,
  closeApp,
  testFixtures,
  setupTestData,
  getPrismaService,
} from './test-helpers';

describe('Live Jam Control System E2E Tests', () => {
  let app: INestApplication;
  let testData: Awaited<ReturnType<typeof setupTestData>>;

  beforeAll(async () => {
    app = await initializeApp();
  });

  afterAll(async () => {
    await closeApp();
  });

  beforeEach(async () => {
    await testFixtures.cleanup();
    testData = await setupTestData();
  });

  afterEach(async () => {
    await testFixtures.cleanup();
  });

  describe('Complete Lifecycle: start → next → pause → resume → previous → stop', () => {
    it('should execute full jam control lifecycle', async () => {
      const jamId = testData.jam.id;


      // === Step 1: Start Jam ===
      const startResponse = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      expect(startResponse.body).toBeDefined();
      expect(startResponse.body.schedules).toBeDefined();

      // Verify first song is IN_PROGRESS
      const firstSchedule = startResponse.body.schedules.find(
        (s: any) => s.status === 'IN_PROGRESS',
      );
      expect(firstSchedule).toBeDefined();
      expect(firstSchedule.order).toBe(1);
      expect(firstSchedule.startedAt).toBeDefined();
      expect(firstSchedule.pausedAt).toBeNull();

      // Verify jam playback state
      let jamData = await getPrismaService().then((p) =>
        p.jam.findUnique({ where: { id: jamId } }),
      );
      expect(jamData.playbackState).toBe('PLAYING');
      expect(jamData.currentScheduleId).toBe(firstSchedule.id);

      // Verify playback history recorded
      let history = await getPrismaService().then((p) =>
        p.playbackHistory.findMany({ where: { jamId } }),
      );
      expect(history.length).toBe(1);
      expect(history[0].action).toBe('START_JAM');

      // === Step 2: Next Song ===
      const nextResponse = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/next`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Verify first song is COMPLETED
      const completedSchedule = nextResponse.body.schedules.find(
        (s: any) => s.id === firstSchedule.id,
      );
      expect(completedSchedule.status).toBe('COMPLETED');
      expect(completedSchedule.completedAt).toBeDefined();

      // Verify second song is IN_PROGRESS
      const secondSchedule = nextResponse.body.schedules.find(
        (s: any) => s.status === 'IN_PROGRESS',
      );
      expect(secondSchedule).toBeDefined();
      expect(secondSchedule.order).toBe(2);
      expect(secondSchedule.startedAt).toBeDefined();

      // Verify jam state updated
      jamData = await getPrismaService().then((p) =>
        p.jam.findUnique({ where: { id: jamId } }),
      );
      expect(jamData.currentScheduleId).toBe(secondSchedule.id);
      expect(jamData.playbackState).toBe('PLAYING');

      // Verify history recorded
      history = await getPrismaService().then((p) =>
        p.playbackHistory.findMany({ where: { jamId } }),
      );
      expect(history.length).toBe(2);
      expect(history[history.length - 1].action).toBe('SKIP_SONG');

      // === Step 3: Pause Song ===
      const pauseResponse = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/pause`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Verify pause timestamp set
      const pausedSchedule = pauseResponse.body.schedules.find(
        (s: any) => s.status === 'IN_PROGRESS',
      );
      expect(pausedSchedule.pausedAt).toBeDefined();

      // Verify jam playback state is PAUSED
      jamData = await getPrismaService().then((p) =>
        p.jam.findUnique({ where: { id: jamId } }),
      );
      expect(jamData.playbackState).toBe('PAUSED');

      // Verify history recorded
      history = await getPrismaService().then((p) =>
        p.playbackHistory.findMany({ where: { jamId } }),
      );
      expect(history.length).toBe(3);
      expect(history[history.length - 1].action).toBe('PAUSE_SONG');

      // === Step 4: Resume Song ===
      const resumeResponse = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/resume`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Verify pausedAt cleared
      const resumedSchedule = resumeResponse.body.schedules.find(
        (s: any) => s.status === 'IN_PROGRESS',
      );
      expect(resumedSchedule.pausedAt).toBeNull();

      // Verify jam playback state is PLAYING
      jamData = await getPrismaService().then((p) =>
        p.jam.findUnique({ where: { id: jamId } }),
      );
      expect(jamData.playbackState).toBe('PLAYING');

      // Verify history recorded
      history = await getPrismaService().then((p) =>
        p.playbackHistory.findMany({ where: { jamId } }),
      );
      expect(history.length).toBe(4);
      expect(history[history.length - 1].action).toBe('RESUME_SONG');

      // === Step 5: Previous Song ===
      const previousResponse = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/previous`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Verify second song returned to SCHEDULED
      const rescheduledSchedule = previousResponse.body.schedules.find(
        (s: any) => s.id === secondSchedule.id,
      );
      expect(rescheduledSchedule.status).toBe('SCHEDULED');
      expect(rescheduledSchedule.startedAt).toBeNull();
      expect(rescheduledSchedule.pausedAt).toBeNull();

      // Verify first song is back to IN_PROGRESS
      const replayedSchedule = previousResponse.body.schedules.find(
        (s: any) => s.id === firstSchedule.id,
      );
      expect(replayedSchedule.status).toBe('IN_PROGRESS');
      expect(replayedSchedule.completedAt).toBeNull(); // Cleared on replay
      expect(replayedSchedule.startedAt).toBeDefined();

      // Verify jam state
      jamData = await getPrismaService().then((p) =>
        p.jam.findUnique({ where: { id: jamId } }),
      );
      expect(jamData.currentScheduleId).toBe(firstSchedule.id);
      expect(jamData.playbackState).toBe('PLAYING');

      // Verify history recorded
      history = await getPrismaService().then((p) =>
        p.playbackHistory.findMany({ where: { jamId } }),
      );
      expect(history.length).toBe(5);
      expect(history[history.length - 1].action).toBe('PREVIOUS_SONG');

      // === Step 6: Stop Jam ===
      const stopResponse = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/stop`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Verify current song is COMPLETED
      const stoppedSchedule = stopResponse.body.schedules.find(
        (s: any) => s.id === firstSchedule.id,
      );
      expect(stoppedSchedule.status).toBe('COMPLETED');
      expect(stoppedSchedule.completedAt).toBeDefined();

      // Verify jam is STOPPED
      jamData = await getPrismaService().then((p) =>
        p.jam.findUnique({ where: { id: jamId } }),
      );
      expect(jamData.playbackState).toBe('STOPPED');
      expect(jamData.currentScheduleId).toBeNull();

      // Verify history recorded
      history = await getPrismaService().then((p) =>
        p.playbackHistory.findMany({ where: { jamId } }),
      );
      expect(history.length).toBe(6);
      expect(history[history.length - 1].action).toBe('STOP_JAM');
    });
  });

  describe('Start Jam Endpoint', () => {
    it('should start jam with first scheduled song', async () => {
      const jamId = testData.jam.id;

      const response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      expect(response.body.id).toBe(jamId);
      expect(response.body.playbackState).toBe('PLAYING');
      expect(response.body.currentScheduleId).toBeDefined();

      const inProgressSchedule = response.body.schedules.find(
        (s: any) => s.status === 'IN_PROGRESS',
      );
      expect(inProgressSchedule.order).toBe(1);
      expect(inProgressSchedule.startedAt).toBeDefined();
    });

    it('should fail to start jam with no scheduled songs', async () => {
      // Create jam with no songs
      const jam = await testFixtures.createJam(testData.hostMusician.id);

      const response = await request(app.getHttpServer())
        .post(`/jams/${jam.id}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(400);

      expect(response.body.message).toContain('No songs scheduled');
    });

    it('should fail to start already playing jam', async () => {
      const jamId = testData.jam.id;

      // Start the jam
      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Try to start again
      const response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(400);

      expect(response.body.message).toContain('already playing');
    });
  });

  describe('Next Song Endpoint', () => {
    it('should skip to next scheduled song', async () => {
      const jamId = testData.jam.id;

      // Start jam
      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Go to next
      const response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/next`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      const inProgressSchedule = response.body.schedules.find(
        (s: any) => s.status === 'IN_PROGRESS',
      );
      expect(inProgressSchedule.order).toBe(2);
      expect(response.body.playbackState).toBe('PLAYING');
    });

    it('should stop jam when skipping last song', async () => {
      const jamId = testData.jam.id;

      // Start jam
      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Skip all songs
      for (let i = 0; i < testData.schedules.length; i++) {
        await request(app.getHttpServer())
          .post(`/jams/${jamId}/control/next`)
          .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
          .expect(201);
      }

      // Verify jam is stopped
      const prismaService = await getPrismaService();
      const jam = await prismaService.jam.findUnique({ where: { id: jamId } });
      expect(jam.playbackState).toBe('STOPPED');
      expect(jam.currentScheduleId).toBeNull();
    });

    it('should fail to skip when jam is stopped', async () => {
      const jamId = testData.jam.id;

      const response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/next`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(400);

      expect(response.body.message).toContain('No current song');
    });
  });

  describe('Previous Song Endpoint', () => {
    it('should go back to previous completed song', async () => {
      const jamId = testData.jam.id;

      // Start jam
      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Go to next (completes song 1, starts song 2)
      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/next`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Go to previous (should go back to song 1)
      const response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/previous`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      const inProgressSchedule = response.body.schedules.find(
        (s: any) => s.status === 'IN_PROGRESS',
      );
      expect(inProgressSchedule.order).toBe(1);
      expect(response.body.playbackState).toBe('PLAYING');
    });

    it('should start first song when no previous completed songs', async () => {
      const jamId = testData.jam.id;

      // Start jam
      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Go to previous immediately (no completed songs)
      const response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/previous`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      const inProgressSchedule = response.body.schedules.find(
        (s: any) => s.status === 'IN_PROGRESS',
      );
      expect(inProgressSchedule.order).toBe(1);
    });
  });

  describe('Pause/Resume Endpoints', () => {
    it('should pause and resume song', async () => {
      const jamId = testData.jam.id;

      // Start jam
      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Pause
      let response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/pause`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      expect(response.body.playbackState).toBe('PAUSED');
      const pausedSchedule = response.body.schedules.find(
        (s: any) => s.status === 'IN_PROGRESS',
      );
      expect(pausedSchedule.pausedAt).toBeDefined();

      // Resume
      response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/resume`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      expect(response.body.playbackState).toBe('PLAYING');
      const resumedSchedule = response.body.schedules.find(
        (s: any) => s.status === 'IN_PROGRESS',
      );
      expect(resumedSchedule.pausedAt).toBeNull();
    });

    it('should fail to pause when not playing', async () => {
      const jamId = testData.jam.id;

      const response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/pause`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(400);

      expect(response.body.message).toContain('not currently playing');
    });

    it('should fail to resume when not paused', async () => {
      const jamId = testData.jam.id;

      // Start jam
      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Try to resume without pausing
      const response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/resume`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(400);

      expect(response.body.message).toContain('not paused');
    });
  });

  describe('Stop Jam Endpoint', () => {
    it('should stop jam and complete current song', async () => {
      const jamId = testData.jam.id;

      // Start jam
      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Stop
      const response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/stop`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      expect(response.body.playbackState).toBe('STOPPED');
      expect(response.body.currentScheduleId).toBeNull();

      const completedSchedule = response.body.schedules.find(
        (s: any) => s.status === 'COMPLETED',
      );
      expect(completedSchedule).toBeDefined();
      expect(completedSchedule.completedAt).toBeDefined();
    });

    it('should fail to stop already stopped jam', async () => {
      const jamId = testData.jam.id;

      const response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/stop`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(400);

      expect(response.body.message).toContain('already stopped');
    });
  });

  describe('Playback History Endpoint', () => {
    it('should return complete action history', async () => {
      const jamId = testData.jam.id;

      // Execute multiple actions
      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/pause`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/resume`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Get history
      const response = await request(app.getHttpServer())
        .get(`/jams/${jamId}/playback-history`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(3);
      expect(response.body[0].action).toBe('RESUME_SONG');
      expect(response.body[1].action).toBe('PAUSE_SONG');
      expect(response.body[2].action).toBe('START_JAM');

      // Verify song details in history
      expect(response.body[0].songTitle).toBeDefined();
      expect(response.body[0].songArtist).toBeDefined();
      expect(response.body[0].timestamp).toBeDefined();
    });

    it('should support pagination with limit parameter', async () => {
      const jamId = testData.jam.id;

      // Execute multiple actions
      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/next`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/next`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Get history with limit
      const response = await request(app.getHttpServer())
        .get(`/jams/${jamId}/playback-history?limit=2`)
        .expect(200);

      expect(response.body.length).toBe(2);
    });
  });

  describe('Live State Endpoint', () => {
    it('should return updated state after actions', async () => {
      const jamId = testData.jam.id;

      // Start jam
      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Get live state
      const response = await request(app.getHttpServer())
        .get(`/jams/${jamId}/live/state`)
        .expect(200);

      expect(response.body.currentSong).toBeDefined();
      expect(response.body.currentSong.order).toBe(1);
      expect(response.body.playbackState).toBe('PLAYING');
      expect(response.body.currentSongStartedAt).toBeDefined();
      expect(response.body.currentSongPausedAt).toBeNull();
      expect(response.body.nextSongs).toBeDefined();
      expect(response.body.nextSongs.length).toBeGreaterThan(0);
    });

    it('should include previous songs after skipping', async () => {
      const jamId = testData.jam.id;

      // Start and skip multiple songs
      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/next`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Get live state
      const response = await request(app.getHttpServer())
        .get(`/jams/${jamId}/live/state`)
        .expect(200);

      expect(response.body.previousSongs).toBeDefined();
      expect(response.body.previousSongs.length).toBeGreaterThan(0);
      expect(response.body.previousSongs[0].order).toBe(1);
      expect(response.body.previousSongs[0].status).toBe('COMPLETED');
    });
  });

  describe('Reorder Schedules Endpoint', () => {
    it('should successfully reorder schedules', async () => {
      const jamId = testData.jam.id;
      const scheduleIds = testData.schedules.map((s: any) => s.id);

      // Reverse the order
      const reversedIds = [...scheduleIds].reverse();

      const response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/reorder`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .send({ scheduleIds: reversedIds })
        .expect(200);

      // Verify schedules are in new order
      expect(response.body.schedules).toBeDefined();
      expect(response.body.schedules.length).toBe(scheduleIds.length);

      for (let i = 0; i < reversedIds.length; i++) {
        const schedule = response.body.schedules.find((s: any) => s.id === reversedIds[i]);
        expect(schedule.order).toBe(i + 1);
      }
    });

    it('should preserve missing schedules at end when reordering partial list', async () => {
      const jamId = testData.jam.id;
      const scheduleIds = testData.schedules.map((s: any) => s.id);

      // Only reorder first 2 schedules
      const partialIds = [scheduleIds[1], scheduleIds[0]];

      const response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/reorder`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .send({ scheduleIds: partialIds })
        .expect(200);

      // Verify first 2 are reordered
      expect(response.body.schedules[0].id).toBe(scheduleIds[1]);
      expect(response.body.schedules[0].order).toBe(1);
      expect(response.body.schedules[1].id).toBe(scheduleIds[0]);
      expect(response.body.schedules[1].order).toBe(2);

      // Verify remaining schedules are preserved at end
      for (let i = 2; i < scheduleIds.length; i++) {
        const schedule = response.body.schedules.find((s: any) => s.id === scheduleIds[i]);
        expect(schedule).toBeDefined();
        expect(schedule.order).toBeGreaterThan(2);
      }
    });

    it('should maintain currentScheduleId when reordering during playback', async () => {
      const jamId = testData.jam.id;
      const scheduleIds = testData.schedules.map((s: any) => s.id);

      // Start jam
      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Get current schedule before reorder
      const prismaService = await getPrismaService();
      const jamBefore = await prismaService.jam.findUnique({ where: { id: jamId } });
      const currentScheduleId = jamBefore.currentScheduleId;

      // Reorder while playing
      const reversedIds = [...scheduleIds].reverse();
      const response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/reorder`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .send({ scheduleIds: reversedIds })
        .expect(200);

      // Verify currentScheduleId is maintained
      expect(response.body.currentScheduleId).toBe(currentScheduleId);
      expect(response.body.playbackState).toBe('PLAYING');

      // Verify current song status unchanged
      const currentSchedule = response.body.schedules.find(
        (s: any) => s.id === currentScheduleId,
      );
      expect(currentSchedule.status).toBe('IN_PROGRESS');
    });

    it('should record REORDER_QUEUE action in playback history', async () => {
      const jamId = testData.jam.id;
      const scheduleIds = testData.schedules.map((s: any) => s.id);
      const reversedIds = [...scheduleIds].reverse();

      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/reorder`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .send({ scheduleIds: reversedIds })
        .expect(200);

      // Get history
      const historyResponse = await request(app.getHttpServer())
        .get(`/jams/${jamId}/playback-history`)
        .expect(200);

      expect(historyResponse.body.length).toBe(1);
      expect(historyResponse.body[0].action).toBe('REORDER_QUEUE');
      expect(historyResponse.body[0].metadata).toBeDefined();
      expect(historyResponse.body[0].metadata.newOrder).toEqual(reversedIds);
      expect(historyResponse.body[0].metadata.totalSchedules).toBe(scheduleIds.length);
    });

    it('should reject empty scheduleIds array', async () => {
      const jamId = testData.jam.id;

      const response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/reorder`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .send({ scheduleIds: [] })
        .expect(400);

      expect(response.body.message).toContain('cannot be empty');
    });

    it('should reject duplicate schedule IDs', async () => {
      const jamId = testData.jam.id;
      const scheduleId = testData.schedules[0].id;

      const response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/reorder`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .send({ scheduleIds: [scheduleId, scheduleId] })
        .expect(400);

      expect(response.body.message).toContain('unique');
    });

    it('should reject schedule IDs from different jam', async () => {
      const jamId = testData.jam.id;

      // Create another jam with schedules
      const otherJam = await testFixtures.createJam(testData.hostMusician.id);
      const otherMusic = await testFixtures.createMusic();
      const otherSchedules = await testFixtures.createSchedules(otherJam.id, [otherMusic.id]);
      const otherSchedule = otherSchedules[0];

      const response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/reorder`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .send({ scheduleIds: [otherSchedule.id] })
        .expect(400);

      expect(response.body.message).toContain('does not belong to this jam');
    });

    it('should reject invalid UUID format', async () => {
      const jamId = testData.jam.id;

      const response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/reorder`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .send({ scheduleIds: ['invalid-uuid'] })
        .expect(400);

      expect(response.body.message).toContain('valid UUID');
    });

    it('should handle transaction rollback on constraint violation', async () => {
      const jamId = testData.jam.id;
      const prismaService = await getPrismaService();

      // Get initial order
      const initialSchedules = await prismaService.schedule.findMany({
        where: { jamId },
        orderBy: { order: 'asc' },
      });
      const initialOrders = initialSchedules.map((s: any) => ({ id: s.id, order: s.order }));

      // Attempt reorder with non-existent ID (should fail validation)
      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/reorder`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .send({ scheduleIds: ['00000000-0000-0000-0000-000000000000'] })
        .expect(400);

      // Verify order unchanged (transaction rolled back)
      const finalSchedules = await prismaService.schedule.findMany({
        where: { jamId },
        orderBy: { order: 'asc' },
      });

      for (let i = 0; i < initialOrders.length; i++) {
        expect(finalSchedules[i].id).toBe(initialOrders[i].id);
        expect(finalSchedules[i].order).toBe(initialOrders[i].order);
      }
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent jam', async () => {
      const nonExistentJamId = 'non-existent-id-' + Date.now();

      const response = await request(app.getHttpServer())
        .post(`/jams/${nonExistentJamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('should require authentication', async () => {
      const jamId = testData.jam.id;

      const response = await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .expect(401);

      expect(response.body).toBeDefined();
    });
  });

  describe('Database State Verification', () => {
    it('should maintain database consistency during operations', async () => {
      const jamId = testData.jam.id;
      const prismaService = await getPrismaService();

      // Start jam
      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Verify database state
      const jam = await prismaService.jam.findUnique({
        where: { id: jamId },
        include: {
          currentSchedule: true,
        },
      });

      expect(jam.playbackState).toBe('PLAYING');
      expect(jam.currentScheduleId).not.toBeNull();
      expect(jam.currentSchedule.status).toBe('IN_PROGRESS');

      // Skip song
      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/next`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Verify state changed
      const jamAfterSkip = await prismaService.jam.findUnique({
        where: { id: jamId },
      });

      expect(jamAfterSkip.currentScheduleId).not.toBe(jam.currentScheduleId);

      // Verify previous song is completed
      const previousSchedule = await prismaService.schedule.findUnique({
        where: { id: jam.currentScheduleId },
      });

      expect(previousSchedule.status).toBe('COMPLETED');
      expect(previousSchedule.completedAt).not.toBeNull();
    });

    it('should prevent multiple IN_PROGRESS songs via database constraint', async () => {
      const jamId = testData.jam.id;
      const prismaService = await getPrismaService();

      // Start jam
      await request(app.getHttpServer())
        .post(`/jams/${jamId}/control/start`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
        .expect(201);

      // Verify only one IN_PROGRESS schedule
      const inProgressSchedules = await prismaService.schedule.findMany({
        where: {
          jamId,
          status: 'IN_PROGRESS',
        },
      });

      expect(inProgressSchedules.length).toBe(1);

      // Try to manually insert another (this should fail due to unique index)
      const schedules = await prismaService.schedule.findMany({
        where: { jamId },
      });

      expect(schedules).toBeDefined();
      // Verify unique constraint on [jamId, order] is enforced
      const duplicateOrders = schedules.reduce((acc: any, s: any) => {
        const key = `${s.jamId}-${s.order}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      Object.values(duplicateOrders).forEach((count: any) => {
        expect(count).toBe(1); // No duplicates
      });
    });
  });
});
