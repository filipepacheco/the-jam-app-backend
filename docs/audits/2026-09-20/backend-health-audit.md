# Backend health audit

Audit date: 2026-09-20 UTC (2026-09-19 São Paulo). Baseline commit: `689ccb25236d3c3472978a551e87b602420e79a7`.

Scope: phases 1 and 2 only—baseline and audit. Application code, dependencies, schema, and deployments were not changed. Existing untracked files were retained. Build regenerated ignored build output and Prisma client. This report and supporting evidence are new local artifacts.

Subsequent progress: this document retains the original audit snapshot. Step 3 is now tracked in the [GitHub remediation backlog](https://github.com/filipepacheco/the-jam-app-backend/issues/1), covering all 21 findings and decision/investigation follow-ups. See [the local backlog map](remediation-backlog.md) and [first-batch verification](remediation-pass-1.md) for later status; historical failures below are not current test results.

## Assessment

The backend builds and has useful existing structure: separate playback/live queries, explicit update allowlists, bounded list pagination, narrowed public selections, input validation, and sanitized database error responses. The highest risks are inconsistent authorization and state invariants, plus an unreliable test safety net. A focused correction program is justified; the evidence does not justify a wholesale rewrite.

## Baseline

| Check | Result | Evidence |
| --- | --- | --- |
| Runtime | Node 20.20.2, npm 10.8.2 | Local executable versions |
| `npm run build` | PASS, exit 0 | [Build log](evidence/build.log) |
| `npm run lint:check` | FAIL: 2 formatting errors, 32 warnings | [Lint log](evidence/lint.log) |
| `npm run test:cov -- --runInBand --watchman=false` | FAIL: no unit tests found; coverage unavailable | [Unit log](evidence/unit.log) |
| E2E | BLOCKED: all 31 cases fail during database initialization/cleanup; not 31 established application defects | [E2E log](evidence/e2e.log) |
| Disposable database | Docker CLI exists, daemon socket absent; no `postgres`/`initdb` executable found | [Docker log](evidence/docker.log) |
| `npm audit --omit=dev --json` | 15 affected production dependency entries: 8 high, 6 moderate, 1 low, 0 critical | [Registry audit JSON](evidence/dependencies.json) |
| Isolated behavior probes | PASS: reproduce service/guard defects using real compiled classes and in-memory adapters | [Auth/import/guard probes](evidence/probes.log), [domain probes](evidence/domain-probes.log) |
| OpenAPI comparison | 42 current operations versus 40 saved; two missing operations and three identifier parameter renames | [Comparison](evidence/swagger.log) |
| CI | Only tag-triggered deploy workflow found; no repository test/lint gate | `.github/workflows/deploy-production.yml:12–20` |

The E2E attempt explicitly overrode DATABASE_URL, DIRECT_URL and Supabase endpoints to `127.0.0.1:1`, with dummy credentials and NODE_ENV=test. No production/staging database was contacted. The suite loads normal application configuration and its teardown deletes all core rows, so running the bare command against the existing environment would be unsafe. A functional E2E baseline remains outstanding until a disposable database and isolated auth fixtures are supplied.

The dependency audit initially failed inside the sandbox with DNS failure, then succeeded with approved network access. Counts describe npm's affected dependency entries, including transitive chains—not fifteen independently demonstrated exploits. Advisory reachability and development-only dependencies were not exhaustively evaluated. No automatic dependency fixes were applied.

## Findings

Priorities: **P1** address before relying on the affected operation; **P2** material correctness/reliability risk; **P3** maintainability or contract debt. Confidence refers to evidence, not deployment exploitability. Source line references are relative to the audited commit/workspace.

### H01 — P1: E2E cleanup and seeds can erase an ordinary configured database

**Evidence:** `test/test-helpers.ts:10–27,144–154`; `src/app.module.ts:22–26`; `prisma/seed.ts:11–17`; `prisma/seed-test-users.ts:9`.

The test harness boots AppModule with its normal `.env` loading and unconditionally calls unfiltered `deleteMany` across playback history, registrations, schedules, links, jams, songs and musicians. The seed scripts similarly delete existing data. No test database identity guard is present. A developer running E2E with a working staging/production DATABASE_URL can erase that database.

**Action:** make disposable database provisioning and explicit test-target validation prerequisites; scope fixture cleanup or destroy a dedicated database. **Verify:** refuse a non-test target before any query. High confidence, static evidence; no destructive operation executed successfully.

### H02 — P1: ordinary users can inject playback statuses through schedule creation

**Evidence:** `src/escala/escala.controller.ts:13–20`, `src/escala/dto/create-escala.dto.ts:21–28`, `src/escala/escala.service.ts:35–40`.

The user role can POST a schedule with SCHEDULED, IN_PROGRESS, or COMPLETED. The write does not reconcile Jam.currentScheduleId, timestamps or playback history. A user can bypass suggestion/approval and playback commands even if the database prevents two simultaneous IN_PROGRESS rows.

**Action:** assign allowed initial status server-side according to actor permissions and route transitions through the playback invariant owner. **Verify:** ordinary-user attempts to create privileged statuses fail or become suggestions. High confidence; service behavior and role allowance inspected.

### H03 — P1: ordinary users can edit ownerless jams

**Evidence:** `src/jam/jam.controller.ts:217–228`, `src/jam/jam.service.ts:322–345`.

The update route admits users; the denial condition requires the existing hostMusicianId to be truthy. An ownerless jam therefore accepts another user's name/status changes. Ownerless records are possible through the optional create field, host deletion (SetNull), and the CSV importer.

**Action:** deny non-host updates when ownership is absent and define a deliberate owner-assignment flow. **Verify:** authenticated non-host cannot modify an ownerless jam. High confidence, reproduced with actual JamService.

### H04 — P1: Spotify import mutates the catalog before rejecting an unauthorized caller

**Evidence:** `src/spotify/spotify.service.ts:69–108,115–136`; `src/spotify/spotify.controller.ts:20–21`.

New APPROVED music rows are created before checking whether the caller owns the requested jam. A caller can receive 403 after catalog writes have already succeeded. Nonexistent/inactive targets also fail after those writes.

**Action:** authorize the target before external fetches and database mutations. **Verify:** rejected requests make zero writes. High confidence; in-memory probe confirms one catalog write before 403.

### H05 — P1: paused-to-start violates the single-current-song invariant

**Evidence:** `src/jam/jam-playback.service.ts:29–56`; `src/jam/jam-live-state.service.ts:61,105`.

Start rejects PLAYING but accepts PAUSED. With paused song A and queued song B, it marks B IN_PROGRESS and moves the pointer without clearing A. Read projections choose the first IN_PROGRESS row while commands use the pointer, so they can disagree.

**Action:** define/restrict start from PAUSED and protect the transition atomically. **Verify:** start→pause→start preserves one coherent current song or returns a deliberate client error. High confidence, reproduced. With a deployed partial unique index, the invalid write may fail instead of persisting two rows; deployed constraints were not inspected.

### H06 — P1: generic schedule mutation bypasses playback and relation invariants

**Evidence:** `src/escala/dto/update-escala.dto.ts:4`, `src/escala/escala.service.ts:50–81`; `prisma/schema.prisma` CurrentSchedule and Registration relations.

Update accepts inherited jamId, musicId and status and writes them directly. Moving an active/registered schedule between jams leaves old registration/history jam IDs and the original current pointer inconsistent. Deleting the active schedule nulls the pointer through its foreign key without changing PLAYING.

**Action:** restrict structural edits after participation/playback starts and make active removal a coordinated transition. **Verify:** active removal and cross-jam movement cannot leave inconsistent pointers/registrations. High confidence, static evidence.

### H07 — P2: feedback rate limiting is not enforced

**Evidence:** `src/feedback/feedback.controller.ts:42–45`, `src/feedback/feedback.module.ts:9–12`, `src/app.module.ts`; repository search finds ThrottlerGuard only on AuthController.

Feedback sets @Throttle metadata but runs only OptionalJwtGuard. No global throttler guard is installed. Anonymous submissions can bypass the declared five-per-hour limit.

**Action:** install the enforcing guard in the correct scope and choose storage appropriate to the deployment's multiple instances. **Verify:** the sixth same-client submission returns 429. High confidence; actual decorator metadata inspected.

### H08 — P2: auth cache can accept a token after its expiry

**Evidence:** `src/auth/services/token-cache.service.ts:15,18–24,49–52`, `src/auth/strategies/supabase-jwt.strategy.ts:28–53`; optional guard has the same cache path.

Cache entries expire five minutes after insertion, independent of the token's exp. A token validated shortly before expiration remains accepted from cache until that TTL ends. Cache hits bypass Supabase verification.

**Action:** cap cache lifetime at the validated token expiry and define invalidation expectations. **Verify:** a provider-accepted token cached before expiry is rejected after expiry. High confidence; clock-controlled probe with a mocked provider. This is not proof of accepting arbitrary forged tokens.

### H09 — P2: queue ordering breaks after deletion and is vulnerable to concurrent creation

**Evidence:** `src/escala/escala.service.ts:29–40`; `prisma/schema.prisma:135`.

The next order is count+1. Existing orders [1,3] produce another 3. A transaction at default isolation also does not serialize concurrent count+insert requests.

**Action:** choose a consistent order allocation/reindexing policy with matching uniqueness and concurrency handling. **Verify:** delete-middle→append and simultaneous appends produce deterministic valid ordering. High confidence, reproduced sequentially. A deployed unique index turns the demonstrated duplicate into a failed create; it does not repair allocation.

### H10 — P2: duplicate registration rules do not match database identity

**Evidence:** `src/inscricao/inscricao.service.ts:30–51,70–83`; `prisma/schema.prisma:113–114`.

Application duplicate detection uses musician/jam/schedule/instrument, but the database unique constraint uses nullable legacy jamMusicId. Current create omits jamMusicId. Two concurrent creates can both pass the precheck. Instrument updates do not rerun duplicate checks.

**Action:** settle the intended registration identity, migrate existing rows, then enforce it atomically with a matching constraint. **Verify:** concurrent identical requests and conflicting instrument updates cannot produce duplicate participation. High confidence in schema/code mismatch; real PostgreSQL race not exercised.

### H11 — P2: queue exhaustion leaves a live jam that stop cannot finish

**Evidence:** `src/jam/jam-playback.service.ts:81–85,155–167`.

Next on the last song sets STOPPED/null but leaves Jam.status LIVE. Stop then rejects it as already stopped. The normal playback-control path cannot finish that event without a separate generic update.

**Action:** define and apply the terminal transition consistently. **Verify:** advancing beyond the last song reaches the agreed end state and stop behaves consistently. High confidence, reproduced.

### H12 — P2: public performer projections include unapproved registrations

**Evidence:** `src/jam/jam-live-state.service.ts:32–36,54–58,95–99`.

Both public live views include registrations without an APPROVED filter, then omit status from the output. Pending/rejected applicants appear as performers, and consumers cannot filter the result themselves.

**Action:** filter approved participants at the projection query. **Verify:** mixed-status fixture exposes only approved performers. High confidence, static evidence.

### H13 — P2: playback decisions are made before transactional writes

**Evidence:** `src/jam/jam-playback.service.ts:124–137` and pause/resume implementations.

Commands read the current pointer/state before their transactions and do not lock or compare a version in their writes. Concurrent pause/next can use the same old snapshot and update different pieces of state inconsistently.

**Action:** serialize state transitions per jam or use transactional state/version preconditions with retries. **Verify:** PostgreSQL integration tests orchestrate overlapping commands and assert pointer/status/timestamp/history invariants. High confidence in stale-read window; specific database interleavings remain unverified.

### H14 — P2: soft-deleted jams remain reachable through other write/read paths

**Evidence:** `src/jam/jam-playback.service.ts:18–22`, `src/escala/escala.service.ts:21–26`, `src/inscricao/inscricao.service.ts:21–28`, `src/musica/musica.service.ts:18–28`.

Jam CRUD uses deletedAt filtering, but playback and participation existence checks do not. Catalog listing includes linked Jam records without a deletedAt filter. Retaining a deleted jam's ID allows state changes or participation in a hidden event; its data can still appear through catalog relations.

**Action:** consistently apply the active/nondeleted jam rule at domain entry points and public projections. **Verify:** deleted jams reject commands and disappear from public relation payloads. High confidence, static evidence.

### H15 — P2: Spotify import is not atomic or reliably retryable

**Evidence:** `src/spotify/spotify.service.ts:174–207`.

JamMusic is committed before Schedule. If schedule creation fails, the link remains. The next import treats the existing link as a duplicate and skips it, leaving the missing schedule unrepaired. The initial dedup maps/sets also are not updated during the import, so repeated tracks in one playlist can cause duplicate catalog rows or repeated link errors.

**Action:** make each link/schedule addition atomic and update dedup state; define partial-success/retry semantics. **Verify:** injected schedule failure leaves no orphan link and retry completes once. High confidence, static control-flow evidence.

### H16 — P2: test suite no longer matches the application contract

**Evidence:** `test/test-helpers.ts:162–170`, `test/jam-control.e2e-spec.ts:34–49,769–803`, `src/jam/jam.controller.ts:112–123`, `src/jam/jam-playback.service.ts:58–64`.

Tests expect HTTP 201 and a full schedules array; controllers now return 200 and compact control responses. Authentication defaults to the string 'test' without a guard override or isolated Supabase fixture. The test named database constraint enforcement never attempts a violating write. App setup also omits the production global exception filter/CORS setup.

**Action:** restore hermetic authenticated fixtures and current response assertions; share app setup and test actual constraint violations. **Verify:** the suite runs from a clean checkout and detects deliberate invariant regressions. High confidence, static comparisons; database setup blocked execution beyond initialization.

### H17 — P2: repository cannot reproduce all database protections

**Evidence:** `.gitignore:27–28`; `git ls-files prisma/migrations` returns only the bio and jam-notes migrations; local ignored SQL contains order uniqueness and IN_PROGRESS partial indexes absent from schema.prisma.

A checkout/schema push does not establish all protections claimed by docs/tests. Local and deployed databases may have materially different constraints. The two tracked incremental migrations are not a complete initial schema history.

**Action:** establish a versioned, reproducible schema/constraint rollout and audit actual deployed constraints read-only before migration planning. **Verify:** a clean disposable database gets every required index and constraint. High confidence; no claim made about which indexes currently exist in production.

### H18 — P2: no automated quality gate; no unit-test baseline

**Evidence:** `.github/workflows/deploy-production.yml:12–20`, `package.json` Jest configuration, unit/lint logs.

The sole workflow deploys tags directly through Vercel without lint/test steps. No src/*.spec.ts files are present. Vercel runs the configured build, but compile success does not establish runtime behavior.

**Action:** repair isolation and regression tests, then enforce build/lint/test checks before release. **Verify:** a deliberately failing regression prevents deployment. Remote branch protections and Vercel dashboard settings were not audited.

### H19 — P2: production dependency audit reports high-severity affected entries

**Evidence:** [Full registry result](evidence/dependencies.json), [package summary](evidence/dependency-summary.md), `package-lock.json`.

npm reports 8 high, 6 moderate and 1 low affected production dependency entries, including Nest dependency chains, multer, path-to-regexp and ws. Fixes are offered; some require major upgrades. This code does not use file uploads or uuid v3/v5/v6, so those advisory paths need reachability triage rather than assuming direct exploitability.

**Action:** evaluate advisory prerequisites against actual routes, select compatible upgrades and run behavior regressions. **Verify:** re-audit the resulting lockfile and document remaining accepted risks. High confidence in registry snapshot; exploitability unproven. Do not run audit fix --force blindly.

### H20 — P2: environment filename ignore rules miss files already present

**Evidence:** `.gitignore:6–9`; initial/final `git status --short` shows `.env.prod` and `.env.staging` untracked and unignored.

A broad add can include deployment environment files. Their contents were not opened for this audit, and there is no finding that credentials have been committed or leaked.

**Action:** ignore deployment environment variants while retaining a documented example template. **Verify:** git check-ignore covers all local env variants. High confidence, filename-only check.

### H21 — P3: OpenAPI and agent documentation are stale

**Evidence:** [OpenAPI comparison](evidence/swagger.log), `scripts/generate-swagger.ts:9–23`, `src/main.ts` bearer configuration, `test/README.md`, root AGENTS.md/CLAUDE.md.

Saved OpenAPI lacks GET /musicos/{id} and PATCH /musicas/jam-music/{jamMusicId}/jam/{jamId}; three Jam paths still use {id} instead of {identifier}. The generator omits bearer security scheme setup; main registers JWT-auth while default ApiBearerAuth refers to bearer. Response declarations also drift from actual projected/control payloads. Docs claim unit tests, 40+ E2E cases, WebSockets, and some database guarantees that this checkout does not establish. CLAUDE.md is ignored, so the prior Agent skills pointer is local-only.

**Action:** unify document generation/configuration, add contract checks, correct documentation and decide which agent instructions should travel with the repository. **Verify:** regenerated operations/security references match runtime declarations. High confidence, generated route comparison without connecting a database.

## Policy decisions and lower-priority observations

These are not silently treated as confirmed vulnerabilities:

- **Global host versus event owner:** many routes let any isHost user control another host's schedules/registrations/playback; Jam update allows global-host override, Jam delete enforces actual ownership. Choose one explicit capability model. See RoleGuard, JamController and InscricaoController.
- **Collaborative song editing:** PATCH /musicas/:id deliberately includes user. The probe confirms an ordinary account passes the guard and UpdateMusicDto includes approval status and instrument requirements. Confirm whether musicians should edit the shared catalog or only propose changes; current permissions allow global edits.
- **Spotify-created host:** import without jamId is auth-only and can assign an ordinary user as hostMusicianId, but playback guards require isHost. Decide how event ownership and host role are granted together.
- **Profile privacy:** authenticated musician list/detail selects phone/contact (`src/musico/musico.service.ts:8–18`), despite its 'excludes PII' comment. Determine who is entitled to these fields before changing visibility.
- **Identity linking:** Supabase strategy relinks an existing email match even when it is already attached to a different identity. Review verified-email/provider assumptions; provider configuration was not inspected. Concurrent first requests can also race create and hit a unique error.
- **Logout:** backend endpoint simply acknowledges logout; it does not invalidate cache or provider sessions. Confirm frontend/provider responsibility and document the contract.
- **Capacity/instruments:** define unknown instrument handling, per-song capacity and participation on canceled/finished songs. Existing normalization is useful but does not establish those business rules.
- **Operational readiness:** /health returns HTTP 200 with body status=error on database failure; /ready always reports ready. HTTP-status-only monitors can miss database outages. Decide desired liveness/readiness semantics.
- **Integration resilience:** Spotify fetches have no explicit timeout/retry budget. Export can leave a partially populated remote playlist if a later batch fails. Retry semantics and deployment time budgets need tests.
- **Validation/type debt:** CreateJam status is only IsString; music status query casts to any; several string fields lack length limits. strictNullChecks/noImplicitAny are off. Prioritize concrete contracts over enabling strict mode across the repo in one patch.

## Leftovers and operational scripts

Reference searches found candidates, not authorization to delete them:

| Candidate | Evidence / next check |
| --- | --- |
| Local JWT strategy/JwtModule/passport-jwt | Registered in AuthModule, but no AuthGuard('jwt') or JwtService caller found in src/scripts/test/prisma. JWT_SECRET remains required solely for this registered legacy path. Verify external integrations before removal. |
| Supabase anon provider | SUPABASE_CLIENT is declared/exported but no injection consumer found. Verify whether exported modules outside this repo use it. |
| @vercel/analytics | Production dependency; no backend source usage found. Candidate removal after dependency/build check. |
| Domainless CLAUDE.md folders | Local memory files exist under frontend-style paths (components/pages/hooks/locales) in the backend, largely ignored. They are not compiled application functionality. |
| CSV import script (untracked) | Actual operational workflow, not dead code. Uses name-based musician identity and reuses schedule by order without checking musicId. Reimporting a reordered CSV can attach registrations to the wrong song. No transaction covers the full import. Review idempotency with fixtures before reuse. |
| Spotify enrichment script (untracked) | Actual operational workflow, not dead code. Chooses search results heuristically and updates shared Music.link; selecting a jam does not limit the effect to that jam. Keep dry-run/review workflow and verify intended matches. |
| Destructive seed scripts | Useful only with explicit disposable-target guard; see H01. Do not mistake them for safe onboarding commands. |

## Architecture candidates

1. **Strong: deepen Jam execution.** Invariant knowledge currently spans playback commands, generic schedule writes, public projections and implicit database constraints. Concentrate transition validation, pointer/status/timestamp updates and history in one module, with commands and tests crossing the same seam. This gives locality for H02/H05/H06/H09/H11/H13. Choose the exact interface only after agreeing the transition rules.
2. **Strong: deepen registration identity/approval.** Resolve schedule versus legacy JamMusic identity, then align atomic writes, constraints and performer selection. Leverage: one policy supports registration commands and both public views. Keep the existing Prisma adapter; a generic repository abstraction is not justified merely to enable mocks.
3. **Worth exploring: concentrate Jam import orchestration.** Jam CRUD and Spotify import independently create jams, links and schedules. Put authorization and atomic additions behind a deliberate module interface, retaining SpotifyApiClient as the external adapter. Improves H04/H15 locality and allows provider-failure tests without external calls.

These are candidates, not approved interface designs. A separate visual report in the OS temp directory shows before/after responsibility diagrams.

## Audit coverage and limits

| Area | Examined |
| --- | --- |
| Auth/Supabase | Guards, strategies, token cache, profile updates, provider construction, local Supabase reference |
| Jam | CRUD/identifiers/soft delete, playback transitions/history/reorder, public projections, DTO contracts |
| Schedules/registrations | Creation/update/delete, actor checks, normalization, identity/order constraints |
| Musicians/music | CRUD, field selections, permissions, pagination, shared catalog mutations |
| Spotify/feedback | Routes, external adapter, partial writes, dedup, rate limiting, input/output shape |
| Infrastructure | Bootstrap/CORS/filter/logging/correlation, environment validation, health/readiness, Prisma schema and tracked/ignored SQL |
| Quality/operations | Build/lint/test configs, E2E fixtures/assertions, workflow/Vercel config, seeds/import scripts, dependencies, OpenAPI and documentation |

Recent-history prioritization (last 35 commits) identified JamService, JamController, music routes, Prisma schema and Spotify import as frequently changed areas; every module above was still included. File/route inspection is not proof of all behavior. No real database concurrency, provider/OAuth flow, production configuration, production data integrity, HTTP load test or external penetration test was performed. In-memory probes demonstrate application decisions and do not emulate PostgreSQL constraints or isolation. No full historical secret scan was performed.

## Proposed remediation order (no issues or fixes created)

1. Establish a disposable test database, auth fixture and safety guards (H01/H16); verify actual database constraints read-only (H17).
2. Close permission/write-order holes (H02/H03/H04) and restore feedback/auth expiry protections (H07/H08). Decide global host and catalog-editing policy.
3. Lock down playback/schedule invariants with regression and concurrency tests (H05/H06/H09/H11/H13), then registration/public projection consistency (H10/H12/H14).
4. Repair import atomicity/retries (H15), triage and update dependencies (H19), protect env files (H20), and enforce CI gates (H18).
5. Refresh contracts/docs (H21), then remove confirmed unused code and consider the architecture candidates. Keep broad formatting/type migrations separate from behavior fixes.

Next milestone: convert accepted findings into bounded GitHub tickets with verification criteria. Phases 3–5 were not executed.

## Reproducing the safe probes

From the repository root, after a successful build:

```sh
node docs/audits/2026-09-20/evidence/probes.cjs
node docs/audits/2026-09-20/evidence/domain-probes.cjs "$PWD"
node docs/audits/2026-09-20/evidence/swagger.cjs
```

These scripts use compiled application classes; auth/import/domain probes supply in-memory dependencies. Swagger probe overrides endpoints to unreachable local values and creates metadata without app.init/listen. They are audit evidence, not a replacement for regression tests. Do not run the bare E2E command until H01 isolation is addressed.
