# Remediation pass 7 — operational contracts and validated cleanup (#24/#25)

`GET /health` is now a process-liveness probe and never depends on PostgreSQL. `GET /ready` queries PostgreSQL and returns HTTP 503 when the dependency is unavailable, so HTTP-status-only load balancers can remove an unhealthy instance. Spotify provider requests have a ten-second deadline. If export creates a remote playlist but cannot populate its tracks, the 502 response includes the partial playlist ID and URL for operator cleanup or retry.

Repository reference checks confirmed that the local JWT strategy, `JwtModule`, `passport-jwt`, Supabase anonymous backend client and `@vercel/analytics` had no runtime consumers. They and their obsolete environment requirements were removed. The Supabase service-role client remains the sole backend provider. Ignored agent-memory files and the two untracked operational import/enrichment scripts were deliberately retained; the audit identified those scripts as real workflows requiring separate data-safety design, not dead code.

Verification:

- 99 disposable-PostgreSQL HTTP tests passed across 12 suites.
- 30 regression tests and 18 database/seed safety checks passed.
- Build and type checking passed.
- Lint passed with the existing `src/musica/musica.service.ts` explicit-`any` warning.
- Production dependency audit remains at zero vulnerabilities.

No deployed system or database was changed.
