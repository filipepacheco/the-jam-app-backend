function assertTestDatabase(env = process.env) {
  let url;
  try {
    url = new URL(env.JAM_TEST_DATABASE_URL);
  } catch {
    throw new Error('E2E requires an isolated database. Run npm run test:e2e (Docker required).');
  }
  if (
    env.NODE_ENV !== 'test' ||
    env.DATABASE_URL !== env.JAM_TEST_DATABASE_URL ||
    env.DIRECT_URL !== env.JAM_TEST_DATABASE_URL ||
    url.protocol !== 'postgresql:' ||
    url.hostname !== '127.0.0.1' ||
    !/^\/jam_test_[a-f0-9]{24}$/.test(url.pathname) ||
    !url.port ||
    url.search ||
    url.hash
  ) {
    throw new Error('Refusing non-isolated E2E database configuration. Run npm run test:e2e.');
  }
}
module.exports = { assertTestDatabase };
