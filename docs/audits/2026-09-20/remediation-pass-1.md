# Remediation pass 1

Scope authorized by continuation of the backend audit. Baseline: `689ccb25236d3c3472978a551e87b602420e79a7`. Test boundaries explicitly agreed: HTTP routes, public playback/import operations, and the test runner's refusal to touch non-test databases.

## Acceptance criteria

- E2E provisions a fresh local PostgreSQL container; it cannot silently use configured application databases. Guards run before application loading and cleanup. No application database or production deployment is changed.
- Ordinary musicians may suggest songs but cannot submit privileged initial schedule statuses (H02). Existing global-host policy is preserved.
- Ordinary users cannot update ownerless jams; owners and existing global hosts retain their update rights (H03).
- Imports into unauthorized, missing or inactive existing jams are rejected before catalog writes (H04).
- Start while paused is rejected; resume keeps the same current song (H05).
- Advancing beyond the last song makes the jam FINISHED/STOPPED with no current song (H11).
- Regression tests exercise public behavior; PostgreSQL E2E assertions match the current compact response and explicit reorder updates contract.
- Deployment env variants are ignored (H20). Existing unrelated untracked work is preserved.

## Explicit remaining work

H01 is only partially addressed: E2E is guarded, but destructive seed commands still require hardening. H16's test harness and stale assertions are repaired, and all 29 PostgreSQL E2E tests pass on the disposable database. Ignored historical constraints, queue/registration concurrency, generic host schedule mutations, feedback throttling, token expiry caching, public approval projections, import atomicity, dependency upgrades and broader permission-policy decisions remain open. This pass neither validates nor migrates deployed database constraints.

No tickets, commits, pushes or deployments are part of this pass. The original audit report is a historical snapshot; its evidence probes intentionally reproduce pre-fix behavior and are superseded for regression purposes by the new tests.

## Verification

- `npm test -- --runInBand --watchman=false --coverage`: 4 suites, 16 tests pass, including real HTTP permission paths. Tests were observed failing on the relevant pre-fix behavior before production changes.
- `npm run test:safety`: 8 safety checks pass.
- `npm run build`: passes. Final test-file edits additionally checked with `tsc --noEmit --incremental false`.
- `npm run lint:check`: passes with one pre-existing `no-explicit-any` warning in MusicaService; zero errors.
- Direct E2E Jest execution without runner configuration: refused before loading app/test cases (expected failure), establishing the guard is wired into the test entry point.
- `npm run test:e2e`: 1 suite, 29 tests pass against disposable PostgreSQL 16 after Docker became available. Container removal was independently verified after the runner exited successfully.
- Coverage snapshot: 27.86% statements, 9.82% branches, 28.21% lines. These are narrow regression tests, not comprehensive backend coverage.
- `git diff --check`: passes.

Logs: [regression/coverage](evidence/remediation-tests.log), [build](evidence/remediation-build.log), [lint](evidence/remediation-lint.log), [guard refusal](evidence/remediation-e2e-guard.log), [PostgreSQL E2E](evidence/remediation-e2e.log).

## Standards review

Independent review identified permissions tested outside the agreed HTTP boundary and a hidden mutable host-token fixture. Permission tests now use real HTTP controllers, guards and authentication strategy with external adapters replaced; E2E control requests receive an explicit fixture token. No outstanding blocking standards findings.

## Spec review

Independent review identified the HTTP-boundary gap and a Docker readiness race against PostgreSQL's temporary Unix-socket server. Readiness now probes TCP; permission tests cover ordinary users, owners, global hosts and unauthenticated callers. Narrow re-review passed. E2E timestamp checks and partial-update preservation were retained through public reads. PostgreSQL runtime verification subsequently passed all 29 E2E cases.

Final review: zero outstanding blocking findings on either axis; deployed historical constraints and concurrency remain outside this suite’s validation scope.
