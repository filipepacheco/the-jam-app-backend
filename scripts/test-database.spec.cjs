const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertTestDatabase } = require('./test-database.cjs');

test('refuses application database configuration without an isolated test target', () => {
  assert.throws(
    () =>
      assertTestDatabase({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost/production' }),
    /isolated/,
  );
});

const isolated = 'postgresql://test:fake@127.0.0.1:54321/jam_test_0123456789abcdef01234567';
const valid = {
  NODE_ENV: 'test',
  JAM_TEST_DATABASE_URL: isolated,
  DATABASE_URL: isolated,
  DIRECT_URL: isolated,
};
test('accepts an explicitly isolated loopback target', () =>
  assert.doesNotThrow(() => assertTestDatabase(valid)));
for (const [name, changes] of Object.entries({
  'non-test environment': { NODE_ENV: 'production' },
  'different application database': { DATABASE_URL: 'postgresql://localhost/production' },
  'different direct database': { DIRECT_URL: 'postgresql://localhost/production' },
  'remote host': Object.fromEntries(
    ['JAM_TEST_DATABASE_URL', 'DATABASE_URL', 'DIRECT_URL'].map((k) => [
      k,
      isolated.replace('127.0.0.1', 'example.com'),
    ]),
  ),
  'ordinary database name': Object.fromEntries(
    ['JAM_TEST_DATABASE_URL', 'DATABASE_URL', 'DIRECT_URL'].map((k) => [
      k,
      isolated.replace('jam_test_0123456789abcdef01234567', 'production'),
    ]),
  ),
  'schema override': Object.fromEntries(
    ['JAM_TEST_DATABASE_URL', 'DATABASE_URL', 'DIRECT_URL'].map((k) => [
      k,
      isolated + '?schema=public',
    ]),
  ),
}))
  test('rejects ' + name, () =>
    assert.throws(() => assertTestDatabase({ ...valid, ...changes }), /isolated/),
  );
