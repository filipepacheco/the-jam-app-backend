# Live Jam Control System - E2E Tests

This directory contains comprehensive end-to-end tests for the live jam control system implementation.

## Overview

The E2E tests cover the complete lifecycle of jam playback control:
- **Full Lifecycle**: start → next → pause → resume → previous → stop
- **Individual Endpoints**: Tests for each control action
- **Edge Cases**: Error handling, invalid state transitions, empty queues
- **Database Verification**: Ensuring data consistency and constraints

## Test Files

### `jam-control.e2e-spec.ts`
Main test suite with 40+ test cases covering:

#### Lifecycle Tests
- Complete lifecycle: start → next → pause → resume → previous → stop
- Verifies state transitions at each step
- Validates database consistency
- Confirms action history recording

#### Start Jam Endpoint
- ✅ Start jam with first scheduled song
- ❌ Start jam with no scheduled songs
- ❌ Start already playing jam

#### Next Song Endpoint
- ✅ Skip to next scheduled song
- ✅ Stop jam when skipping last song (graceful termination)
- ❌ Skip when jam is stopped

#### Previous Song Endpoint
- ✅ Go back to previous completed song
- ✅ Start first song when no previous completed songs

#### Pause/Resume Endpoints
- ✅ Pause and resume song with state persistence
- ✅ Pause preserves timeline for analytics
- ❌ Pause when not playing
- ❌ Resume when not paused

#### Stop Jam Endpoint
- ✅ Stop jam and complete current song
- ❌ Stop already stopped jam

#### Playback History Endpoint
- ✅ Return complete action history (newest first)
- ✅ Pagination support with limit parameter
- ✅ Include song and musician details

#### Live State Endpoint
- ✅ Return updated state after actions
- ✅ Include previous songs after skipping
- ✅ Track timestamps and pause state

#### Error Handling
- ✅ Handle non-existent jam (404)
- ✅ Require authentication (401)

#### Database Consistency
- ✅ Maintain state during operations
- ✅ Prevent multiple IN_PROGRESS songs via unique index
- ✅ Enforce unique constraint on [jamId, order]

### `test-helpers.ts`
Utility module providing:
- Application initialization and cleanup
- Test fixtures for creating musicians, songs, jams, schedules
- Database cleanup helpers
- Complete test data setup

## Running Tests

### Prerequisites
1. Environment variables configured in `.env`
2. Database must be accessible
3. NestJS dependencies installed

### Run All E2E Tests
```bash
npm run test:e2e
```

### Run Specific Test Suite
```bash
npm run test:e2e -- --testNamePattern="Complete Lifecycle"
```

### Run with Coverage
```bash
npm run test:e2e -- --coverage
```

### Watch Mode (for development)
```bash
npm run test:e2e -- --watch
```

### Debug Mode
```bash
npm run test:e2e -- --verbose
```

## Test Data Setup

Each test automatically:
1. Creates a host musician
2. Creates 4 test songs
3. Creates 1 jam session
4. Creates 4 scheduled songs in the jam
5. Creates musician registrations

Cleanup happens after each test to ensure isolation.

## Key Test Scenarios

### Scenario 1: Full Lifecycle
```
1. START_JAM
   - Song 1 → IN_PROGRESS
   - playbackState → PLAYING
   - startedAt set

2. NEXT_SONG
   - Song 1 → COMPLETED (completedAt set)
   - Song 2 → IN_PROGRESS

3. PAUSE_SONG
   - Song 2 → pausedAt set
   - playbackState → PAUSED

4. RESUME_SONG
   - Song 2 → pausedAt cleared
   - playbackState → PLAYING

5. PREVIOUS_SONG
   - Song 2 → SCHEDULED
   - Song 1 → IN_PROGRESS (completedAt cleared for replay)

6. STOP_JAM
   - Song 1 → COMPLETED
   - playbackState → STOPPED
   - currentScheduleId → null
```

### Scenario 2: Navigation to Last Song
```
1. START_JAM → Song 1 playing
2. NEXT, NEXT, NEXT, NEXT → Song 4 playing
3. NEXT → playbackState → STOPPED (graceful termination)
```

### Scenario 3: Multiple Pause/Resume Cycles
```
1. START_JAM → Song 1 playing
2. PAUSE_SONG → pausedAt set
3. RESUME_SONG → pausedAt cleared
4. PAUSE_SONG → pausedAt set again
5. RESUME_SONG → pausedAt cleared again
```

## Expected Test Output

```
Live Jam Control System E2E Tests
  Complete Lifecycle: start → next → pause → resume → previous → stop
    ✓ should execute full jam control lifecycle (XXXms)
  Start Jam Endpoint
    ✓ should start jam with first scheduled song (XXXms)
    ✓ should fail to start jam with no scheduled songs (XXXms)
    ✓ should fail to start already playing jam (XXXms)
  Next Song Endpoint
    ✓ should skip to next scheduled song (XXXms)
    ✓ should stop jam when skipping last song (XXXms)
    ✓ should fail to skip when jam is stopped (XXXms)
  [... more test results ...]
  
Test Suites: 1 passed, 1 total
Tests:       41 passed, 41 total
Snapshots:   0 total
Time:        5.432 s
```

## Continuous Integration

For CI/CD pipelines:
```bash
# Run tests and fail on coverage below threshold
npm run test:e2e -- --coverage --coverageThreshold='{"global":{"lines":80}}'
```

## Debugging Tests

### Enable Verbose Logging
```bash
npm run test:e2e -- --verbose
```

### Run Single Test
```bash
npm run test:e2e -- --testNamePattern="should execute full jam control lifecycle"
```

### Debug with Node Inspector
```bash
node --inspect-brk -r ts-node/register node_modules/.bin/jest --config ./test/jest-e2e.json --runInBand
```

Then attach debugger to `chrome://inspect`

## Known Limitations

1. **Authentication**: Tests use mock JWT tokens. Real Supabase authentication integration requires additional setup.
2. **Isolation**: Tests require fresh database state; running in parallel may cause conflicts.
3. **Performance**: First test run generates Prisma client which may take 5-10 seconds.

## Extending Tests

To add new tests:

1. Use `setupTestData()` to create standard test fixtures
2. Use `testFixtures.cleanup()` in `afterEach()` for isolation
3. Mock authentication with `process.env.TEST_AUTH_TOKEN`
4. Verify database state using `getPrismaService()`

Example:
```typescript
it('should test new feature', async () => {
  const { jam, songs, hostMusician } = testData;
  
  const response = await request(app.getHttpServer())
    .post(`/jams/${jam.id}/control/start`)
    .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN || 'test'}`)
    .expect(201);
  
  expect(response.body).toBeDefined();
});
```

## Coverage Report

Generated coverage reports available at:
```
./coverage-e2e/index.html
```

Open in browser to see:
- Line coverage
- Branch coverage
- Function coverage
- Uncovered lines

## Performance Benchmarks

Typical performance metrics:
- Full lifecycle test: ~200-300ms
- Single endpoint test: ~50-100ms
- Complete test suite: ~5-10 seconds (depending on machine)

## Troubleshooting

### Tests Timeout
- Increase Jest timeout: `jest.setTimeout(10000)`
- Check database connection
- Ensure no other instances running

### Database Conflicts
- Verify database is accessible
- Run cleanup between tests: `await testFixtures.cleanup()`
- Check for stale connections

### Authentication Failures
- Set `TEST_AUTH_TOKEN` environment variable
- Verify guard configuration
- Check request headers

## Related Documentation

- [Live Jam Control System Design](../CLAUDE.md)
- [Jam Service Implementation](../src/jam/jam.service.ts)
- [Jam Controller Endpoints](../src/jam/jam.controller.ts)
- [Database Schema](../prisma/schema.prisma)
