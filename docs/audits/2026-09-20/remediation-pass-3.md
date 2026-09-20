# Remediation pass 3 — public performers and deleted jams

Scope: [#13](https://github.com/filipepacheco/the-jam-app-backend/issues/13) and [#15](https://github.com/filipepacheco/the-jam-app-backend/issues/15). Starting commit: `0275672ff3109dea43a7f0a5f89b09d0179c79d9`. Implementation uses Terra agents and the previously agreed HTTP test boundary, with real application services and disposable PostgreSQL.

## Acceptance criteria

- Both public live projections show only APPROVED registrations as performers, preserving song fields and minimal musician fields.
- Retained IDs cannot be used to write playback, schedules or registrations after deleting their jam.
- Public live projections and catalog relations exclude deleted jams.
- Song linking, arrangement notes and Spotify import/export respect the same deletion boundary.
- Verify failed commands and public responses through HTTP, using mixed registration fixtures and IDs retained after HTTP deletion.

This batch enforces deletion checks at command entry. Serializing concurrent deletion and writes remains part of the separate database/concurrency work. It does not decide ownership, registration identity or generic schedule-transition policy.

## Verification

- Regression suite: 5 suites / 27 tests passed.
- Full disposable PostgreSQL E2E suite before review: 5 suites / 38 tests passed. After splitting broad tests, the two changed files passed again with 22 focused cases (20 deletion, 2 performer projection). Production code did not change after the full run.
- Database and seed safety: 18 checks passed.
- TypeScript check passed. Lint required formatting two test expressions; after formatting, its only remaining diagnostic is the existing MusicaService `no-explicit-any` warning.
- Focused red/green checks reproduced unapproved performer leakage and deleted-jam entry-point failures. Import returned 503 after attempting the stubbed provider; export returned 400 after reading the deleted jam. Both now return 404 before processing the deleted event.

All 83 tests/checks in the full run passed; the subsequent focused run verifies the test-only review refinements. Evidence logs are under `evidence/pass3-*.log`; stored output has trailing whitespace normalized. No production migration or deployment is part of this batch.

## Standards review

Initial review identified overly broad test cases. These were split by HTTP capability so a failure identifies the affected route. The reviewer also raised possible duplication of deletion predicates as a design heuristic. The predicates remain beside their queries: root lookups, nested relation filters and already-loaded parent checks have different result shapes, so a shared helper would add indirection without simplifying this repair.

The independent rereview confirmed the granularity finding resolved and withdrew the duplication heuristic after considering the rationale. Zero remaining standards findings.

## Spec review

Independent review found zero gaps or scope creep against the acceptance criteria. Concurrent deletion/write serialization remains explicitly deferred.
