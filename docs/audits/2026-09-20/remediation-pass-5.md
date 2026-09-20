# Remediation pass 5 — schedule safeguards and queue ordering (#7/#10)

## Accepted contract and implementation

Generic schedule edits cannot transfer a slot to another event or assign queue positions. Playback controls own IN_PROGRESS/COMPLETED, including initial creation by hosts. Unplayed slots may still transition among SUGGESTED/SCHEDULED/CANCELED through PATCH. Music replacement is rejected after registrations or history exist, or after playback has started.

Current/completed removal is rejected. Unplayed slots with registrations or history are canceled and retained; empty slots are deleted. Mutations lock the parent jam and then the slot before inspecting participation/history, so a successful registration racing removal is retained. Per-event owner/shared-host authorization remains separate #23 work; this batch keeps the existing role checks.

Append, Spotify allocation, reorder and generic mutations serialize on the same parent jam row. The parent lock permits foreign-key key-share locks; removal takes a slot update lock before counting dependent records. Allocation appends after the highest occupied position. Partial reorder moves supplied songs to the front by their submitted ranks, retains the relative order of omitted songs, and renumbers every slot from 1. Duplicate ranks and direct PATCH order assignment are rejected. Temporary positions avoid occupied and final positions, including legacy integer-limit values.

`20260920010000_add_unique_schedule_queue_order` adds unique `(jamId, order)` enforcement. The baseline is unchanged. Spotify's JamMusic link and schedule insertion are now atomic per track; whole-import atomicity/retry behavior remains #16 work. Playback-to-playback concurrency remains #14 work.

No deployed database was read or changed. Existing targets require the #18 catalog/ledger transition and duplicate-position preflight before applying the new migration. Versioned fresh-database tests do not establish deployed protections.

## Verification

TDD failures reproduced active-slot deletion, registered-slot history loss, cross-jam movement, generic playback-status changes, active cancellation, registered-music replacement, direct position edits and host creation of active/completed slots. Queue tests cover concurrent appends, append versus reorder, import versus append, gaps, partial reorder and integer limits.

Full run: 80 PostgreSQL HTTP tests, 27 regression tests and 18 safety checks passed (125). Review then found that the temporary positive offset could not compact a queue at PostgreSQL's maximum integer. A new HTTP test failed with 400 before the correction; after using free temporary positions and refining the parent lock, all 23 focused queue/lifecycle cases passed. The current suite contains 81 E2E cases; a full 126-case run is not claimed.

TypeScript and lint pass; lint retains the existing `no-explicit-any` warning in `src/musica/musica.service.ts:18`. Swagger JSON/YAML regenerated with dummy provider configuration and the frontend Swagger copy synchronized. Regeneration also refreshes pre-existing documentation drift. An agent ran the build during its initial queue verification despite the workspace's preference for typechecking; subsequent verification used `tsc --noEmit`.

## Review

Standards and Spec were reviewed independently by Terra agents. Spec's integer-limit finding is fixed and re-reviewed; no remaining Spec findings. Standards identified inherited PATCH order documentation with create semantics; explicit update-property descriptions and regenerated Swagger correct it.
