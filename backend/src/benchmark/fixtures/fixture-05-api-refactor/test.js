const assert = require('assert');
const { formatSuccess, formatError } = require('./src/responseFormatter');

function runTests() {
  console.log('Running test suite for fixture-05-api-refactor...');

  // Test 1: formatSuccess (baseline passes)
  const successRes = formatSuccess({ userId: 123 }, { version: '1.0' });
  assert.strictEqual(successRes.success, true);
  assert.deepStrictEqual(successRes.data, { userId: 123 });
  assert.strictEqual(successRes.meta.version, '1.0');
  console.log('✓ formatSuccess verified');

  // Test 2: formatError with details (FAILS ON BASELINE)
  const errRes = formatError('INVALID_CREDENTIALS', 'Email or password incorrect', { attemptsRemaining: 2 });
  assert.strictEqual(errRes.success, false);
  assert(errRes.error && typeof errRes.error === 'object', 'Expected nested error object in envelope');
  assert.strictEqual(errRes.error.code, 'INVALID_CREDENTIALS');
  assert.strictEqual(errRes.error.message, 'Email or password incorrect');
  assert.deepStrictEqual(errRes.error.details, { attemptsRemaining: 2 });
  assert.strictEqual(errRes.errorCode, undefined, 'Legacy errorCode property must not be present');
  assert.strictEqual(errRes.errorMessage, undefined, 'Legacy errorMessage property must not be present');
  console.log('✓ formatError with details verified');

  // Test 3: formatError without details defaults to null
  const errResDefault = formatError('NOT_FOUND', 'Resource not found');
  assert.strictEqual(errResDefault.success, false);
  assert(errResDefault.error && typeof errResDefault.error === 'object');
  assert.strictEqual(errResDefault.error.code, 'NOT_FOUND');
  assert.strictEqual(errResDefault.error.message, 'Resource not found');
  assert.strictEqual(errResDefault.error.details, null);
  console.log('✓ formatError default null details verified');

  console.log('All tests passed successfully!');
}

try {
  runTests();
  process.exit(0);
} catch (err) {
  console.error('Test Suite Failed:', err.message);
  process.exit(1);
}
