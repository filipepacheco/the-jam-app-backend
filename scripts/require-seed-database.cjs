const { assertTestDatabase } = require('./test-database.cjs');

try {
  assertTestDatabase();
} catch {
  throw new Error(
    'Refusing seed: disposable local test database required. See test/README.md for the seed workflow.',
  );
}
