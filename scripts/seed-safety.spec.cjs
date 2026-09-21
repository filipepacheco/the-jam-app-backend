const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

// Substitute the external database adapter so even a regression cannot connect.
function runSeed(entrypoint, overrides) {
  const directory = mkdtempSync(path.join(tmpdir(), 'jam-seed-safety-'));
  const adapter = path.join(directory, 'database-adapter.cjs');
  writeFileSync(
    adapter,
    `
    const Module = require('node:module');
    const load = Module._load;
    Module._load = function (id, ...args) {
      if (id === '@prisma/client') return {
        PrismaClient: class {
          constructor() { throw new Error('DATABASE_CLIENT_CONSTRUCTED'); }
        }
      };
      return load.call(this, id, ...args);
    };
  `,
  );
  try {
    return spawnSync(
      process.execPath,
      ['-r', adapter, '-r', 'ts-node/register/transpile-only', entrypoint],
      {
        cwd: path.resolve(__dirname, '..'),
        env: {
          ...process.env,
          NODE_ENV: 'development',
          DATABASE_URL: 'postgresql://test:never-connect@127.0.0.1:1/application',
          DIRECT_URL: 'postgresql://test:never-connect@127.0.0.1:1/application',
          JAM_TEST_DATABASE_URL: '',
          ...overrides,
        },
        encoding: 'utf8',
        timeout: 10000,
      },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('main seed refuses application configuration before constructing a database client', () => {
  const result = runSeed('prisma/seed.ts');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing seed: disposable local test database required/);
  assert.doesNotMatch(result.stderr, /DATABASE_CLIENT_CONSTRUCTED/);
});

test('RBAC seed refuses application configuration before constructing a database client', () => {
  const result = runSeed('prisma/seed-test-users.ts');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing seed: disposable local test database required/);
  assert.doesNotMatch(result.stderr, /DATABASE_CLIENT_CONSTRUCTED/);
});

const disposableUrl =
  'postgresql://test:never-connect@127.0.0.1:54321/jam_test_0123456789abcdef01234567';
for (const entrypoint of ['prisma/seed.ts', 'prisma/seed-test-users.ts']) {
  test(`${entrypoint} rejects an ordinary database even with all target variables set`, () => {
    const url = 'postgresql://test:never-connect@127.0.0.1:1/application';
    const result = runSeed(entrypoint, {
      NODE_ENV: 'test',
      DATABASE_URL: url,
      DIRECT_URL: url,
      JAM_TEST_DATABASE_URL: url,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Refusing seed: disposable local test database required/);
    assert.doesNotMatch(result.stderr, /DATABASE_CLIENT_CONSTRUCTED/);
  });

  test(`${entrypoint} rejects a mismatched direct target`, () => {
    const result = runSeed(entrypoint, {
      NODE_ENV: 'test',
      DATABASE_URL: disposableUrl,
      JAM_TEST_DATABASE_URL: disposableUrl,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Refusing seed: disposable local test database required/);
    assert.doesNotMatch(result.stderr, /DATABASE_CLIENT_CONSTRUCTED/);
  });

  test(`${entrypoint} refuses remote targets even with a disposable database name`, () => {
    const url = disposableUrl.replace('127.0.0.1', 'database.example.invalid');
    const result = runSeed(entrypoint, {
      NODE_ENV: 'test',
      DATABASE_URL: url,
      DIRECT_URL: url,
      JAM_TEST_DATABASE_URL: url,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Refusing seed: disposable local test database required/);
    assert.doesNotMatch(result.stderr, /DATABASE_CLIENT_CONSTRUCTED/);
  });

  test(`${entrypoint} permits explicitly selected disposable local targets`, () => {
    const result = runSeed(entrypoint, {
      NODE_ENV: 'test',
      DATABASE_URL: disposableUrl,
      DIRECT_URL: disposableUrl,
      JAM_TEST_DATABASE_URL: disposableUrl,
    });
    // The adapter intentionally stops here: this command test never contacts a DB.
    assert.equal(result.status, 1);
    assert.match(result.stderr, /DATABASE_CLIENT_CONSTRUCTED/);
    assert.doesNotMatch(result.stderr, /Refusing seed/);
  });
}
