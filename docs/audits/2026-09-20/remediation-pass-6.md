# Remediation pass 6 — identity, playback, management, imports and release gates

Scope: GitHub #11, #14, #16, #19, #20, #22 and the accepted management-mode slice of #23, with supporting constraints under #18.

Registration identity is now one musician, scheduled-song occurrence and normalized instrument. Concurrent duplicate applications and duplicate-causing host edits return 409, while different instruments and repeated occurrences remain distinct. The forward migration adds the matching unique index; legacy null or duplicate rows still require existing-target preflight.

Playback commands now lock the parent jam before reading state and perform validation, schedule transitions, jam pointer/state updates and history writes inside that transaction. A PostgreSQL partial unique index permits only one `IN_PROGRESS` schedule per jam, and the disposable-database runner checks that database-only index directly.

New events default to owner-only management. Owners may opt into shared-host management for playback, queue changes and registration approvals. Existing events are backfilled to shared-host mode to preserve their prior behavior. Sharing does not grant event deletion or Spotify-import rights.

Spotify database changes are atomic. Existing-target imports serialize on the jam, new-event imports require an 8–128 character `Idempotency-Key`, and catalog tracks use their Spotify URL as a unique identity. Concurrent retries reuse the event, concurrent imports reuse catalog rows, and any database failure rolls back the complete import. Existing targets need duplicate-link and import-key preflight before applying this migration.

CI now runs lint, build, OpenAPI drift, regression, database-safety and disposable-PostgreSQL HTTP checks for pull requests and `main`. Production tags depend on the same reusable workflow and use a pinned Vercel CLI. Compatible dependency upgrades and narrow transitive overrides reduced the production audit from 15 advisories to zero; Node.js 20 is declared and the Supabase client remains pinned to its verified Node 20-compatible release.

Verification on a clean disposable PostgreSQL 16 database:

- 98 HTTP E2E tests passed across 11 suites; all six migrations deployed, migration status was current, Prisma schema comparison was clean, and the partial-index catalog assertion passed.
- 27 regression tests passed across five suites.
- 18 database/seed safety checks passed.
- Build and type checking passed.
- Lint passed with the existing `src/musica/musica.service.ts` explicit-`any` warning.
- Swagger generation and `git diff --check` passed.
- `npm audit --omit=dev --json` reported zero production vulnerabilities.

No deployed database was mutated. Hosted CI evidence, existing-target data preflight and migration execution remain release steps.
