# Saved Schedule and playback

Apply `20260923_playback_queue_order` before deploying the backend. It adds the persisted `Jam.resumeFromQueue` flag with a false default. Deploy this backend before the corresponding frontend.

Playing and pausing never write Schedule positions. IN_PROGRESS remains a lifecycle status while a Performance is paused; only `playbackState === PLAYING` and `currentScheduleId` together lock its position. The editor receives `allSongs`, including completed, canceled, and suggested Performances, and sends their explicit saved positions. Completed statuses remain unchanged. Missing entries stay at their exact positions; a collision with one is rejected rather than moving it.

The `queueRevision` token hashes playback identity/state and every Schedule entry's position, lifecycle and playback timestamps. Read snapshots use repeatable-read isolation. Reorder checks `expectedRevision` under the shared Jam row lock. Stale writes return 409. The token is optional for legacy clients; those clients do not receive compare-and-swap protection. A fresh live-state read returns the new token.

Pause sets `resumeFromQueue` to false. Saving a changed order while paused sets it to true. Resume then selects the first unfinished Performance by saved position and releases the former paused Performance to SCHEDULED if another was selected. A no-op save retains normal Resume behavior and still records history. Reloads and other hosts observe the persisted choice.

Stopped legacy IN_PROGRESS entries are visible and movable immediately; start or reorder releases their stale status without touching position or completed entries.

## Recover displaced positions

The recovery command defaults to a preview:

```sh
npx ts-node scripts/recover-queue-order.ts <jam-id>
npx ts-node scripts/recover-queue-order.ts <jam-id> --apply
```

Use a backend environment with the new migration applied. Pause playback first. The command locks the Jam, reads its latest REORDER_QUEUE history, and recognizes only the old absolute-position payload with gaps and the matching faulty requested-prefix/omitted-suffix result. It reconstructs explicit positions and fills the gaps in the preserved relative order of omitted Performances. New-contract histories, missing history, relative-rank payloads, changed membership, and nonmatching results are skipped. Inspect the preview before applying it; recovery cannot infer history that was never recorded.

Applying uses collision-safe position swaps and records the prior order and source history ID. The new record makes a repeated invocation a no-op. It changes neither completed statuses nor playback selection. No production recovery is run by the tests.

## Verification

`npm test -- --runInBand --watchman=false` covers transitions and recovery evidence. `npm run test:e2e` provisions disposable PostgreSQL, applies migrations and exercises full HTTP contracts including pause/reorder/reload/play and concurrent host actions.
