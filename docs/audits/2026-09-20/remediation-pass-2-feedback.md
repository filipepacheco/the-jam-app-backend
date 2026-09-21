# Feedback rate limiting — H07 / GitHub #8

POST /feedback enforces the existing five-submissions-per-hour policy in PostgreSQL before feedback can be persisted. Anonymous and authenticated requests share the same client-IP bucket. GET /feedback retains its existing host authorization.

Each submission takes a transaction-scoped PostgreSQL advisory lock for the normalized client-IP key, counts recent persisted submissions, and either inserts the new feedback or returns 429 with Retry-After. The transaction serializes concurrent requests across API instances, and the composite IP/timestamp index supports the rolling-window lookup. Requests become eligible again when their oldest submission leaves the one-hour window.

Express trusts an explicit number of proxy hops (`TRUST_PROXY_HOPS`, default 1), so the client identity comes from the platform proxy chain rather than treating arbitrary forwarded headers as trusted at every network depth. Deployments with a different topology must configure this value to match their trusted ingress path.

## Verification

- Existing red evidence: [red evidence](evidence/remediation-feedback-red.log), sixth request returned 201 before the first bounded limiter repair.
- `npm run test:e2e -- --testPathPattern=feedback`: passed using the real AppModule and disposable PostgreSQL; production databases were not used. Log: [passing run](evidence/pass2-feedback.log).
- HTTP regression accepts four anonymous requests and one authenticated request, rejects both anonymous and authenticated subsequent requests with 429, checks Retry-After, and lists only the five accepted rows through the host API. Advancing the clock past the block permits another submission.
- The later cross-instance regression submits equivalent IPv4 and IPv4-mapped IPv6 identities through the shared trusted-proxy configuration and verifies five accepted rows plus one 429 response.
- TypeScript typecheck passed. Targeted ESLint passed after formatting the assertion.

The fleet-wide storage and trusted-proxy decisions are implemented. Review, commit linkage and publication evidence remain required before closure.
