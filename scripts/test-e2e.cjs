const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const { assertTestDatabase } = require('./test-database.cjs');
const root = path.resolve(__dirname, '..');
const suffix = randomBytes(12).toString('hex');
const container = `jam-test-${suffix}`;
const database = `jam_test_${suffix}`;
const password = randomBytes(24).toString('hex');
let started = false;
function docker(args, quiet = false) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 120000 });
  if (result.status !== 0) {
    if (!quiet) process.stderr.write(result.stderr || result.error?.message || 'Docker failed\n');
    throw new Error('Disposable PostgreSQL unavailable. Start Docker and run npm run test:e2e.');
  }
  return result.stdout.trim();
}
function cleanup() {
  if (started) {
    started = false;
    spawnSync('docker', ['rm', '-fv', container], { stdio: 'ignore', timeout: 15000 });
  }
}
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(143);
});
(async () => {
  try {
    docker(['info', '--format', '{{.ServerVersion}}']);
    started = true;
    docker([
      'run',
      '--detach',
      '--rm',
      '--name',
      container,
      '--publish',
      '127.0.0.1::5432',
      '--env',
      `POSTGRES_DB=${database}`,
      '--env',
      'POSTGRES_USER=test',
      '--env',
      `POSTGRES_PASSWORD=${password}`,
      'postgres:16-alpine',
    ]);
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        docker(
          ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'test', '-d', database],
          true,
        );
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (!ready) throw new Error('Disposable PostgreSQL did not become ready.');
    const address = docker(['port', container, '5432/tcp']);
    if (!/^127\.0\.0\.1:\d+$/.test(address)) throw new Error('Unexpected Docker port binding.');
    const url = `postgresql://test:${password}@${address}/${database}`;
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: url,
      DIRECT_URL: url,
      JAM_TEST_DATABASE_URL: url,
      JWT_SECRET: 'isolated-test-secret-not-for-production',
      SUPABASE_URL: 'http://127.0.0.1:1',
      SUPABASE_ANON_KEY: 'test-only',
      SUPABASE_SERVICE_ROLE_KEY: 'test-only',
      SPOTIFY_CLIENT_ID: 'test-only',
      SPOTIFY_CLIENT_SECRET: 'test-only',
    };
    assertTestDatabase(env);
    const assertRequiredIndexes = () => {
      const indexPresent = docker([
        'exec',
        container,
        'psql',
        '-U',
        'test',
        '-d',
        database,
        '--tuples-only',
        '--no-align',
        '--command',
        "SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'escalas' AND indexname = 'escalas_jamId_in_progress_unique';",
      ]);
      if (indexPresent !== '1') {
        throw new Error('Required one-in-progress-schedule partial index is missing.');
      }
    };
    const run = (file, args) => {
      const result = spawnSync(process.execPath, [path.join(root, file), ...args], {
        cwd: root,
        env,
        stdio: 'inherit',
      });
      if (result.status !== 0)
        throw new Error(`Test command failed (exit ${result.status ?? result.signal}).`);
    };
    run('node_modules/prisma/build/index.js', ['migrate', 'deploy']);
    assertRequiredIndexes();
    run('node_modules/prisma/build/index.js', ['migrate', 'status']);
    run('node_modules/prisma/build/index.js', [
      'migrate',
      'diff',
      '--from-schema-datasource',
      'prisma/schema.prisma',
      '--to-schema-datamodel',
      'prisma/schema.prisma',
      '--exit-code',
    ]);
    run('node_modules/jest/bin/jest.js', [
      '--config',
      'test/jest-e2e.json',
      '--runInBand',
      '--watchman=false',
      ...process.argv.slice(2),
    ]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    cleanup();
  }
})();
