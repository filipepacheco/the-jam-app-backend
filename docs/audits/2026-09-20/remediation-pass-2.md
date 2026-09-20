# Remediation pass 2 — safety and authentication

Scope: GitHub [#2](https://github.com/filipepacheco/the-jam-app-backend/issues/2) (seed safety), [#8](https://github.com/filipepacheco/the-jam-app-backend/issues/8) (feedback rate limiting), and [#9](https://github.com/filipepacheco/the-jam-app-backend/issues/9) (token-cache expiry), implemented in parallel agents under the explicitly invoked implement skill.

The current branch starts at `689ccb25236d3c3472978a551e87b602420e79a7`. Prior audit, test harness and first-batch repairs are still uncommitted and will be included deliberately in the reviewed commit. Existing user files `AGENTS.md`, `API_CHANGES.md`, `scripts/enrich-spotify-links.mjs` and `scripts/import-jam-csv.mjs` are outside this change.

## Acceptance criteria

- Destructive seed entry points refuse an ordinary application database before initializing database access. Only explicit disposable/local targets are permitted, without a production override.
- Feedback POST enforces the declared five-per-hour per-client limit, returns 429 on excess requests, and does not persist rejected submissions.
- Cached authentication never outlives token expiry or the five-minute cache TTL. Protected and optional HTTP paths respect expiry; provider verification remains authoritative for initial authentication. Invalid/missing expiry cannot create a permissive cache entry.
- Preserve the first-batch behavior and database-safety tests. Typecheck during implementation, run focused regressions during TDD, and run the full test suites once after integration.
- Independently review standards and spec compliance, then commit the scoped changes on the current branch. Do not push, deploy, migrate a real database, or close tickets based solely on local evidence.

## Implemented behavior and limits

Both seed entry points now validate the strict disposable database configuration before Prisma construction. Ten command-boundary tests cover refusals and accepted disposable configuration. The documented workflow was also exercised against fresh Docker PostgreSQL: both seed commands succeeded and the container was removed. Seed fixture role labels/auth identities retain their existing demo-only limitations.

Feedback uses a PostgreSQL-serialized rolling quota before optional authentication; mixed anonymous/authenticated requests share the client-IP quota, excess writes are rejected, and eligibility returns after the window expires. A two-instance HTTP regression verifies the shared behavior, and the trusted proxy hop count is explicit. See [feedback detail](remediation-pass-2-feedback.md).

Token caching is capped at the earlier of five minutes or the provider-validated token’s expiry, including eviction at the exact boundary. Missing/malformed/nonfinite/past expiry claims are not cached. Eleven HTTP tests cover protected and optional authentication, TTL and invalid expiry behavior. Initial authentication still goes to Supabase; payload decoding only bounds cache lifetime. Revocation may remain delayed until that bounded cache lifetime ends, and logout remains an acknowledgement rather than provider revocation/cache invalidation. These policy questions remain in the backlog.

## Verification

- Full regression suite: 5 suites, 27 tests passed.
- Full disposable PostgreSQL E2E suite: 2 suites, 30 tests passed, including feedback and playback.
- Database/seed safety suite: 18 checks passed.
- TypeScript `tsc --noEmit --incremental false`: passed.
- Lint: zero errors; one pre-existing `no-explicit-any` warning in MusicaService.
- Both seed workflows succeeded against a fresh disposable PostgreSQL database; its container was removed.

Stored command logs retain their output with trailing whitespace normalized for Git.

Evidence: [regressions](evidence/pass2-tests.log), [E2E](evidence/pass2-e2e.log), [safety](evidence/pass2-safety.log), [typecheck](evidence/pass2-typecheck.log), [lint](evidence/pass2-lint.log), [seed workflow](evidence/pass2-seed-workflow.log).

## Standards review

Independent review: zero findings. Changes preserve module boundaries and approved public test seams; adapters/time are replaced only at external boundaries. No blocking documented-standard breach or code-smell finding.

## Spec review

Independent review: zero outstanding findings for the earlier scoped repairs. Seed entry-point guards, feedback quota/rejected-write behavior and token cache boundaries satisfy the bounded acceptance criteria. Shared feedback storage and proxy identity were completed in the later full sweep; revocation/logout policy, schema rollout and uncommitted-to-published release steps remain distinct work.

Review result: Standards 0 findings; Spec 0 findings. Commit locally on the current branch; publishing, ticket closure and deployment remain separate steps.
