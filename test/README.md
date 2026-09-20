# Backend tests

## Regression tests without PostgreSQL

```sh
npm test -- --runInBand
npm run test:safety
```

Tests in `src/**/*.spec.ts` exercise public domain operations and HTTP permissions. Database and external Supabase/Spotify adapters are replaced with local fixtures; application authorization and validation run normally. HTTP tests bind an ephemeral loopback port.

The safety suite checks that the E2E database guard refuses missing, mismatched, remote, non-test and schema-override targets.

## PostgreSQL E2E tests

Start Docker, then run:

```sh
npm run test:e2e
```

The runner creates a fresh `postgres:16-alpine` container with a random database name, password and loopback port. It runs the versioned `prisma migrate deploy` path, checks migration status and checks the resulting database against `prisma/schema.prisma`, supplies dummy provider configuration, runs Jest serially, and removes the container on completion or handled interruption. It never selects the application's existing DATABASE_URL/DIRECT_URL. Initial execution may download the PostgreSQL image.

An early setup guard rejects direct Jest execution unless the runner's isolated database configuration is present. Cleanup repeats this guard before deleting fixtures. Do not manually configure these internal variables to bypass isolation.

Supabase user lookup is replaced with an in-memory identity provider; the real JWT strategy and role guard still run. No Supabase or Spotify credentials are needed. Fixture tokens are unique to each test. The app uses the normal validation pipe and exception filter; bootstrap CORS and other middleware remain outside this suite's coverage.

The suite covers playback lifecycle, invalid transitions, authenticated history, authentication/role failures, public live state and reorder request validation. Assertions use HTTP 200 compact command results and GET projections, matching the current contract.

The baseline reproduces the current Prisma declaration. A subsequent migration enforces unique queue positions, covered by concurrent append/reorder/import tests. The historical one-IN_PROGRESS index is not included pending its coordinated playback fix. This suite does **not** establish deployed partial-index guarantees or PostgreSQL concurrency correctness; those remain audit follow-ups. Destructive seed commands are separate from this runner and now require the same strict disposable database configuration before Prisma initializes.

## Verification

The rewritten PostgreSQL suite passed all 29 tests against a disposable PostgreSQL 16 container. The runner removed the container after completion. See [the recorded run](../docs/audits/2026-09-20/evidence/remediation-e2e.log). The schema and concurrency limitations above still apply.


## Disposable seed workflow

Both seed entry points refuse normal application database configuration. They require `NODE_ENV=test` and identical `DATABASE_URL`, `DIRECT_URL`, and `JAM_TEST_DATABASE_URL` values pointing to an explicit loopback port and a randomly named `jam_test_<24 hex characters>` database. There is no production override. Running `npm run seed` with an ordinary `.env` therefore fails before database access.

For a temporary seeded database, run this from the repository root in Bash. The subshell keeps its variables out of your normal shell and removes its container on exit. Nothing here uses the configured application database. Keep Docker running; the first run may pull the image.

```bash
bash <<'SH'
set -euo pipefail
seed_suffix=$(node -p "require('crypto').randomBytes(12).toString('hex')")
seed_password=$(node -p "require('crypto').randomBytes(24).toString('hex')")
seed_container="jam-seed-$seed_suffix"
seed_database="jam_test_$seed_suffix"
trap 'docker rm -fv "$seed_container" >/dev/null 2>&1 || true' EXIT
docker run --detach --rm --name "$seed_container" --publish 127.0.0.1::5432 \
  --env POSTGRES_USER=test --env "POSTGRES_PASSWORD=$seed_password" \
  --env "POSTGRES_DB=$seed_database" postgres:16-alpine >/dev/null
seed_ready=false
for attempt in {1..60}; do
  if docker exec "$seed_container" pg_isready -h 127.0.0.1 -U test -d "$seed_database" >/dev/null 2>&1; then
    seed_ready=true
    break
  fi
  sleep 0.5
done
[ "$seed_ready" = true ] || { echo 'Disposable PostgreSQL did not become ready.' >&2; exit 1; }
seed_address=$(docker port "$seed_container" 5432/tcp)
[[ "$seed_address" =~ ^127\.0\.0\.1:[0-9]+$ ]] || exit 1
export NODE_ENV=test
export JAM_TEST_DATABASE_URL="postgresql://test:$seed_password@$seed_address/$seed_database"
export DATABASE_URL="$JAM_TEST_DATABASE_URL" DIRECT_URL="$JAM_TEST_DATABASE_URL"
node -e "require('./scripts/require-seed-database.cjs')"
node node_modules/prisma/build/index.js migrate deploy
npm run seed
# Alternatively use: node -r ts-node/register prisma/seed-test-users.ts
# Perform any desired disposable-database inspection here, before the shell exits.
SH
```

The safety suite checks the seed command entry points with a database-access tripwire, so refusal is verified without contacting a database. The command guards are protection against accidental destructive runs, not a security boundary against someone deliberately impersonating the isolated runner configuration.

Seed contents are demo data: synthetic Supabase IDs do not authenticate, and the legacy RBAC seed’s printed role names do not set `isHost`. Use the E2E identity fixtures for authorization tests.
