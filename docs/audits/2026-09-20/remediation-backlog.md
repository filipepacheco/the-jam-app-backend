# Backend health remediation

## Notes

Plan: **1 baseline — done; 2 backend audit — done; 3 remediation backlog — done; 4 small implementation batches — in progress; 5 verify and close — verification performed per batch, publication/closure pending.**

The audit produced 21 findings plus three decision/investigation tickets. Three repair batches are reviewed and committed locally as `0275672` and `0ce5cdf`. Neither commit is published or deployed. All child tickets remain open until their acceptance and closure requirements are satisfied. Open status does not mean every ticket still needs implementation.

## Execution order and current state

### Implemented and verified locally — publication/closure pending

- [ ] #2 — Destructive seed and disposable database safety (`0275672`).
- [ ] #3 — Ordinary-user schedule status permissions (`0275672`).
- [ ] #4 — Ownerless-jam edit authorization (`0275672`).
- [ ] #5 — Spotify target authorization before side effects (`0275672`).
- [ ] #6 — Paused start preserves the current song (`0275672`).
- [ ] #9 — Token cache bounded by credential expiry (`0275672`).
- [ ] #12 — Advancing past the last song finishes the jam (`0275672`).
- [ ] #13 — Approved-only public performers (`0ce5cdf`).
- [ ] #15 — Deleted-jam commands and public relation guards (`0ce5cdf`).
- [ ] #17 — Hermetic HTTP E2E baseline and bootstrap limitations (`0275672`).
- [ ] #21 — Deployment environment files excluded from staging (`0275672`).
- [ ] #11 — Registration identity is enforced per musician/scheduled slot/instrument, including concurrent create and update conflicts.
- [ ] #14 — Playback transitions serialize on the jam and the database enforces one active schedule per jam.
- [ ] #16 — Spotify imports are atomic; existing-event retries are naturally idempotent and new-event retries use an idempotency key.
- [ ] #20 — Production dependency advisories reduced from 15 to zero with compatible updates and targeted overrides.
- [ ] #22 — Portable verification guidance and generated OpenAPI are current; CI rejects OpenAPI drift.
- [ ] #24 — Liveness/readiness HTTP semantics, Spotify request deadlines and partial-export recovery details are implemented and verified locally.
- [ ] #25 — Unused local JWT, anonymous Supabase client and analytics dependencies removed after reference validation; operational scripts retained intentionally.

- [ ] #8 — Feedback quota is serialized in PostgreSQL across API instances, rejects the sixth write with Retry-After, and uses an explicit trusted-proxy hop count. Publication/closure pending.

### Foundations — current focus

- [ ] #23 — Capability policy is implemented locally: per-event management mode, preserved registration withdrawal and lifecycle rules, owner-only event catalog changes, host-only shared catalog mutation, self-only PII, immutable provider identity and an explicit provider-owned logout contract. Publication/closure pending.
- [ ] #18 — Reproducible schema and constraints. Clean installs include all forward constraints, and disposable PostgreSQL directly rejects each protected duplicate. The staging aggregate preflight found one duplicate Spotify-link group, so staging rollout is correctly blocked pending reviewed data reconciliation. No real database migration is authorized.

### Dependent domain repairs

- [ ] #7 — Schedule lifecycle/identity safeguards implemented and verified locally; publication/closure pending. Per-event management mode remains separate #23 work.
- [ ] #10 — Serialized append/import/reorder, unique queue-order migration and accepted partial-reorder behavior implemented and verified on disposable PostgreSQL. Existing-target migration transition remains under #18; publication/closure pending.
- [ ] #19 — Pull requests and `main` pushes run build, lint, unit, safety, disposable-PostgreSQL E2E and OpenAPI drift gates; production tag deployment depends on the reusable gate and pins its Vercel CLI. A real hosted CI run and publication/closure remain.

## Decisions-so-far

- Prefer targeted repairs; the audit does not justify a rewrite.
- User-approved test seams are HTTP routes, public playback/import operations and test-database safety boundaries. PostgreSQL behavior is tested against disposable containers.
- First two repair batches: 27 regression tests, 30 PostgreSQL E2E tests and 18 safety checks passed. Latest batch: full run of 27 regression + 38 E2E + 18 safety checks passed; after splitting broad tests during review, the two changed E2E files passed 22 focused cases. Typecheck passed; lint has one existing warning.
- Schedule/queue repair verification: full run passed 80 PostgreSQL HTTP tests, 27 regression tests and 18 safety checks (125). After the integer-limit review fix, 23 focused queue/lifecycle tests passed. Typecheck and lint pass, with one existing warning.
- Current-schema baseline verification: all 54 PostgreSQL HTTP tests, 27 regression tests and 18 safety checks pass (99 total). Typecheck passes; lint retains one existing warning.
- Final policy/constraint verification: 116 PostgreSQL E2E tests, 34 regression tests and 18 safety checks pass; build, lint, migration replay/schema comparison and generated OpenAPI checks pass.
- Standards and spec reviews have no remaining findings for the committed batches.
- Feedback protection is shared through PostgreSQL and verified across two application instances. Token revocation/logout and deletion/write concurrency remain separate work.
- Close tickets only with acceptance evidence and a published reviewed commit/PR link. Publication, deployment and production migrations are distinct steps.

## Fog

Staging rollout under #18 is blocked by one aggregate duplicate Spotify-link group; production remains uninspected. No claim is made that historical ignored SQL has been applied to any deployed database.

## Evidence

Reports and logs are committed under `docs/audits/2026-09-20/`, including `remediation-pass-1.md`, `remediation-pass-2.md` and `remediation-pass-3.md`. The commit IDs above are local identifiers; permanent repository links await publication.
