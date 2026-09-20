# Remediation backlog

GitHub is the source of truth: [tracking issue](https://github.com/filipepacheco/the-jam-app-backend/issues/1).

## Notes

This is the completed remediation backlog for the backend health audit, dated 2026-09-20 UTC. Baseline: `689ccb25236d3c3472978a551e87b602420e79a7`.

**Plan:** establish a baseline (done) → audit the backend (done) → define the remediation backlog (done) → implement in small batches (first local batch verified; further implementation paused for backlog creation) → verify and close (per ticket after review/commit).

All 21 findings are mapped below, with three additional decision/investigation tickets. Each ticket contains acceptance criteria, historical evidence where applicable, current status and closure requirements. P1 means address before relying on the affected operation; P2 means material reliability/correctness risk; P3 means contract/maintenance debt. `needs-info` distinguishes unresolved policy from specified work. `ready-for-agent` does not override recorded blockers.

## Execution order

Review and land the existing local changes before stacking new fixes. Then take small, independently verifiable batches. Policy and schema investigation can proceed in parallel with independent safety fixes; H12/H14 and CI can move forward when their own blockers are satisfied. Numbered groups are a suggested sequence, not blanket dependencies.

### 0 — Review and land verified local repairs

- [ ] #3 — H02, P1: Prevent ordinary users from creating privileged schedule statuses. Implemented and verified locally; pending commit/review.
- [ ] #4 — H03, P1: Reject unauthorized edits to ownerless jams. Implemented and verified locally; pending commit/review.
- [ ] #5 — H04, P1: Authorize Spotify import targets before side effects. Implemented and verified locally; pending commit/review.
- [ ] #6 — H05, P1: Reject start while paused and preserve the current song. Implemented and verified locally; pending commit/review.
- [ ] #12 — H11, P2: Finish a jam when playback advances beyond the last song. Implemented and verified locally; pending commit/review.
- [ ] #21 — H20, P2: Protect deployment environment files from accidental staging. Implemented and verified locally; pending commit/review.
- [ ] #17 — H16, P2: Complete the hermetic HTTP E2E contract baseline. Core repair verified locally: all 29 PostgreSQL E2E tests passed. Remaining scope is commit/review and accurate bootstrap coverage documentation.

### 1 — Finish safety and access protections

- [ ] #2 — H01, P1: Guard destructive seed commands and retain isolated E2E safety. Partial: isolated Docker E2E provisioning and database guards are implemented locally; destructive seeds remain unguarded.
- [ ] #8 — H07, P2: Enforce the declared feedback submission rate limit. Regression reproduced locally (sixth submission 201 instead of 429); no fix yet.
- [ ] #9 — H08, P2: Bound authentication caching by token expiry. Open; no fix implemented.

### 2 — Resolve policy and database foundations

- [ ] #23 — POLICY, P1: Decide authorization, participation and lifecycle policies. Decision work; current behavior is evidence, not automatically a vulnerability. No policy changes are authorized by this ticket alone.
- [ ] #18 — H17, P2: Version a reproducible database schema and constraint rollout. Open; current E2E uses schema push and does not reproduce ignored historical SQL.

### 3 — Protect domain invariants

- [ ] #7 — H06, P1: Define and enforce safe generic schedule edits and removal. Open; transition/removal policy must be agreed before implementation. Blocked by #23.
- [ ] #10 — H09, P2: Make queue order allocation safe after deletion and concurrent appends. Open; order policy and reproducible constraints required. Blocked by #23, #18.
- [ ] #11 — H10, P2: Align registration identity and database uniqueness. Open; identity policy and migration design required. Blocked by #23, #18.
- [ ] #14 — H13, P2: Serialize playback transitions and verify concurrent commands. Open; no real concurrency guarantees verified yet. Blocked by #18, #7.
- [ ] #13 — H12, P2: Show only approved registrations as public performers. Open.
- [ ] #15 — H14, P2: Apply soft-deletion rules to commands and public relations. Open.

### 4 — Improve reliability and release checks

- [ ] #16 — H15, P2: Make Spotify additions atomic and imports retryable. Open; target authorization is fixed locally under H04, atomicity is not. Blocked by #5, #10.
- [ ] #20 — H19, P2: Triage dependency advisories and apply compatible upgrades. Open; audit snapshot reports 8 high, 6 moderate and 1 low affected production entries.
- [ ] #19 — H18, P2: Gate changes and releases on build, lint and isolated tests. Partial: regression and safety suites exist locally; CI/release gating remains open. Blocked by #17.
- [ ] #24 — OPS, P2: Define readiness and integration failure contracts. Follow-up observations; do not silently treat current health or provider semantics as agreed defects.

### 5 — Refresh contracts and investigate leftovers

- [ ] #22 — H21, P3: Synchronize OpenAPI contracts and repository instructions. Partial: test README corrected locally; OpenAPI and portable agent documentation remain open. Blocked by #23.
- [ ] #25 — CLEANUP, P3: Validate leftover code and operational scripts before cleanup. Investigation backlog; candidate leftovers are not proven dead code.

## Decisions-so-far

- Prefer targeted repairs; the audit does not justify a wholesale rewrite. Deeper jam-execution/registration/import modules are design candidates to evaluate within their tickets, not separate rewrite mandates.
- Tests cross the agreed HTTP, public playback/import and database-safety boundaries. Database concurrency needs actual PostgreSQL tests.
- First-batch local verification: 16 regression tests, 8 safety checks and 29 PostgreSQL playback E2E tests passed; build passed; lint had zero errors and one existing warning. The disposable database container was removed. Six individual fixes are implemented locally; H01/H16/H18/H21 also have partial work. No changes have been committed, pushed or deployed.
- The new H07 test reproduced the missing rate limit. It is intentionally red until that issue is implemented; the earlier 29-test playback success is not a claim that the expanded E2E suite is currently green.
- Close tickets only after their acceptance criteria and relevant checks pass, with a reviewed commit/PR linked. Keep local fixes open until then. A deployment or production migration requires its own release authorization.

## Fog

Capability/ownership rules, registration identity and lifecycle policy are tracked in POLICY. Historical/deployed database constraints remain unverified under H17. Feedback storage must account for serverless instances (H07). Token revocation/logout expectations remain separate from expiry enforcement (H08/POLICY). Readiness and provider failure contracts are in OPS. Cleanup candidates require usage evidence; operational scripts are not presumed dead.

Validation/type debt should follow concrete DTO/contract defects; a blanket strict-mode or formatting migration is not part of this backlog. Repository/domain documentation updates belong to H21.

## Evidence location

The audit, first-batch report and logs currently reside in the uncommitted local `docs/audits/2026-09-20/` directory. Tickets embed relevant findings and check results so they are usable before those artifacts are published. Add permanent commit links when landing the reports; do not use broken GitHub blob links to untracked files.
