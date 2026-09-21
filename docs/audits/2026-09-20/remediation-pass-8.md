# Remediation pass 8 — shared feedback quota

Scope: GitHub #8.

## Result

Feedback submissions now enforce the five-per-hour client quota in PostgreSQL. A transaction-scoped advisory lock serializes requests for the same client IP across API instances; the quota check and accepted write occur in the same transaction. Excess requests return 429 with a positive `Retry-After` header and do not persist feedback.

The application explicitly trusts a configurable number of ingress proxy hops through `TRUST_PROXY_HOPS` (default 1). A composite feedback IP/timestamp index supports rolling-window lookups.

## Verification

- Red: two Nest application instances accepted all six concurrent submissions while each used its own in-memory limiter.
- Green: the same two-instance HTTP test returns five 201 responses and one 429, with five persisted rows.
- Full disposable PostgreSQL E2E: 12 suites, 100 tests passed.
- Regression Jest: 6 suites, 30 tests passed.
- Database/seed safety: 18 tests passed.
- Build passed.
- ESLint: zero errors; one pre-existing `no-explicit-any` warning in `src/musica/musica.service.ts`.

Publication and ticket closure still require a reviewed remote commit/PR link.
