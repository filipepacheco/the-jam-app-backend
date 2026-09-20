# Feedback rate limiting — H07 / GitHub #8

POST /feedback now runs Nest's ThrottlerGuard before optional authentication. The existing route policy (five submissions per hour) is enforced before feedback can be persisted. Anonymous and authenticated requests share the same client-IP bucket. GET /feedback retains its existing host authorization.

The selected storage for this bounded repair is the existing in-memory Nest throttler provider registered by AuthModule. Keys include the controller, handler, throttler name and Express `req.ip`, so the feedback bucket is separate from auth routes. The sixth request returns 429 and Retry-After; it starts a one-hour block under the installed throttler's default policy. Requests become eligible again after that block expires.

This is per-process protection only. Counters disappear on restarts/cold starts and are not shared between serverless instances. It is not a fleet-wide five-per-hour guarantee. Express currently has no explicit trust-proxy configuration; deployment validation must establish which address `req.ip` represents before claiming distinct end-user buckets behind Vercel. Arbitrarily trusting client-supplied forwarding headers would allow bypasses and is not introduced here. Shared storage or platform-level enforcement, including trusted client identity, remains a deployment decision requiring separate agreement before provisioning.

## Verification

- Existing red evidence: [red evidence](evidence/remediation-feedback-red.log), sixth request returned 201 instead of 429 before the guard was installed.
- `npm run test:e2e -- --testPathPattern=feedback`: passed using the real AppModule and disposable PostgreSQL; production databases were not used. Log: [passing run](evidence/pass2-feedback.log).
- HTTP regression accepts four anonymous requests and one authenticated request, rejects both anonymous and authenticated subsequent requests with 429, checks Retry-After, and lists only the five accepted rows through the host API. Advancing the clock past the block permits another submission.
- TypeScript typecheck passed. Targeted ESLint passed after formatting the assertion.

The issue should not be represented as fleet-wide enforcement. Review, commit linkage and any remaining storage/proxy decision must be recorded before closure.
