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

### Partial

- [ ] #8 — Feedback quota enforced per instance; shared serverless storage and trusted proxy identity unresolved.
- [ ] #22 — Test documentation corrected; OpenAPI and portable repository guidance remain. Blocked by #23.

### Foundations — current focus

- [ ] #23 — Authorization, participation and lifecycle decisions. Accepted: per-event owner-only/shared-host management option; generic schedule edits cannot transfer events or set playback status; current/completed deletion prohibited; unique queue positions with explicit reorder; registration identity per musician/slot/instrument; instrument counts are guidance; removal of an unplayed slot with registrations cancels it and preserves history. Remaining decisions are tracked in policy-decisions.md.
- [ ] #18 — Reproducible schema and constraints. Repository inventory and staging-only read-only catalog inspection performed. Staging lacks unique queue positions and the one-IN_PROGRESS index; the playback-history schedule foreign key is present; migration ledger trails current columns. Current-schema clean-install baseline implemented locally with archived legacy SQL; the full 54-case HTTP suite now uses migrate deploy/status/schema comparison. Unique queue-order migration and concurrent HTTP writer checks now exist locally. Registration identity, the playback partial index, existing-target forward rollout and direct constraint-rejection checks remain outstanding. No real database migration authorized.

### Dependent domain repairs

- [ ] #7 — Schedule lifecycle/identity safeguards implemented and verified locally; publication/closure pending. Per-event management mode remains separate #23 work.
- [ ] #10 — Serialized append/import/reorder, unique queue-order migration and accepted partial-reorder behavior implemented and verified on disposable PostgreSQL. Existing-target migration transition remains under #18; publication/closure pending.
- [ ] #11 — Registration identity and uniqueness. Blocked by #23 and #18.
- [ ] #14 — Serialized playback transitions. Blocked by #18 and #7.
- [ ] #16 — Atomic/retryable Spotify imports. Blocked by #5 and #10.
- [ ] #19 — CI/release gates. Formal blocker #17 awaits closure reconciliation; test prerequisites exist locally.

### Other remaining work

- [ ] #20 — Dependency advisory triage and compatible updates.
- [ ] #24 — Readiness and integration failure contracts; decisions needed.
- [ ] #25 — Validate leftovers before deleting code; operational scripts are not presumed dead.

## Decisions-so-far

- Prefer targeted repairs; the audit does not justify a rewrite.
- User-approved test seams are HTTP routes, public playback/import operations and test-database safety boundaries. PostgreSQL behavior is tested against disposable containers.
- First two repair batches: 27 regression tests, 30 PostgreSQL E2E tests and 18 safety checks passed. Latest batch: full run of 27 regression + 38 E2E + 18 safety checks passed; after splitting broad tests during review, the two changed E2E files passed 22 focused cases. Typecheck passed; lint has one existing warning.
- Schedule/queue repair verification: full run passed 80 PostgreSQL HTTP tests, 27 regression tests and 18 safety checks (125). After the integer-limit review fix, 23 focused queue/lifecycle tests passed. Typecheck and lint pass, with one existing warning.
- Current-schema baseline verification: all 54 PostgreSQL HTTP tests, 27 regression tests and 18 safety checks pass (99 total). Typecheck passes; lint retains one existing warning.
- Standards and spec reviews have no remaining findings for the committed batches.
- Feedback protection remains per instance. Token revocation/logout and deletion/write concurrency remain separate work.
- Close tickets only with acceptance evidence and a published reviewed commit/PR link. Publication, deployment and production migrations are distinct steps.

## Fog

Remaining capability boundaries, same-musician simultaneous-part approval, remaining lifecycle and privacy decisions remain under #23. Staging constraint drift is now catalog-verified under #18; production remains uninspected. Shared feedback storage/proxy identity remain under #8. Operational contracts remain under #24. No claim is made that historical ignored SQL has been applied to any deployed database.

## Evidence

Reports and logs are committed under `docs/audits/2026-09-20/`, including `remediation-pass-1.md`, `remediation-pass-2.md` and `remediation-pass-3.md`. The commit IDs above are local identifiers; permanent repository links await publication.
