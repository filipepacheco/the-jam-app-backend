# Remediation pass 9 — remaining policy and constraint verification

Scope: GitHub #18 and the remaining accepted #23 decisions.

## Policy result

- Registration withdrawal preserves history as `WITHDRAWN`; applications and mutations follow explicit event, slot and status boundaries. On-behalf applications are rejected, while one musician may hold multiple approved instrument parts.
- Shared Music mutation requires a host. Event links and arrangement notes require the event owner. Public catalog projections omit private host and import fields.
- Musician directory responses omit phone/contact; the self profile retains them.
- Supabase subject is the immutable local identity. Email equality cannot rebind an account, and first-login races only recover the same subject.
- Logout evicts the local validation-cache entry and explicitly tells the client to complete provider sign-out.

## Constraint result

Disposable PostgreSQL directly rejects duplicate queue positions, registration identities, active schedules, Spotify catalog links and per-host import keys. The staging aggregate-only preflight ran in a repeatable-read, read-only transaction: three checks returned zero and duplicate Spotify links returned one group. No row keys or values were read and no mutation was attempted. Staging migration rollout remains blocked pending reviewed data reconciliation.

## Verification

- Full disposable PostgreSQL E2E: 15 suites, 116 tests passed.
- Regression Jest: 7 suites, 34 tests passed.
- Database/seed safety: 18 tests passed.
- Build, Prisma migration replay/schema comparison, ESLint and Git whitespace checks passed.
- Generated OpenAPI files were refreshed after the contract changes.
