const assert = require('assert');
const { validateRegistration } = require('./src/validator');

function runTests() {
  console.log('Running test suite for fixture-03-validation-recovery...');

  // Test 1: Full registration with valid phone
  const full = validateRegistration({
    username: 'johndoe',
    email: 'John.Doe@Example.COM',
    phone: '555-123-4567'
  });
  assert.strictEqual(full.valid, true);
  assert.strictEqual(full.data.email, 'john.doe@example.com', 'Email must be converted to lowercase');
  console.log('✓ Full registration validated and email normalized');

  // Test 2: Registration without phone (optional) - FAILS ON BASELINE
  const noPhone = validateRegistration({
    username: 'janedoe',
    email: 'jane@example.com'
  });
  assert.strictEqual(noPhone.valid, true, `Expected valid registration without phone, got error: ${noPhone.error}`);
  assert.strictEqual(noPhone.data.phone, null);
  assert.strictEqual(noPhone.data.email, 'jane@example.com');
  console.log('✓ Registration without phone succeeded');

  // Test 3: Invalid username rejected
  const badUser = validateRegistration({ username: 'ab', email: 'ab@test.com' });
  assert.strictEqual(badUser.valid, false);
  console.log('✓ Short username rejected');

  console.log('All tests passed successfully!');
}

try {
  runTests();
  process.exit(0);
} catch (err) {
  console.error('Test Suite Failed:', err.message);
  process.exit(1);
}
