const assert = require('assert');
const { formatUserProfile } = require('./src/index');

function runTests() {
  console.log('Running test suite for fixture-01-syntax-bug...');

  // Case 1: Complete user profile
  const fullUser = {
    id: 'usr_101',
    name: '  Alice Developer  ',
    metadata: {
      preferences: { theme: 'light', notifications: true },
      tags: ['lead', 'core', 'backend']
    }
  };
  const res1 = formatUserProfile(fullUser);
  assert.strictEqual(res1.id, 'usr_101');
  assert.strictEqual(res1.displayName, 'Alice Developer');
  assert.strictEqual(res1.theme, 'light');
  assert.strictEqual(res1.notificationsEnabled, true);
  assert.deepStrictEqual(res1.tags, ['lead', 'core', 'backend']);
  console.log('✓ Case 1: Complete user profile passed');

  // Case 2: User with missing/null metadata (FAILS ON BASELINE)
  const userNullMeta = {
    id: 'usr_102',
    name: 'Bob Builder',
    metadata: null
  };
  const res2 = formatUserProfile(userNullMeta);
  assert.strictEqual(res2.id, 'usr_102');
  assert.strictEqual(res2.displayName, 'Bob Builder');
  assert.strictEqual(res2.theme, 'dark');
  assert.strictEqual(res2.notificationsEnabled, false);
  assert.deepStrictEqual(res2.tags, []);
  console.log('✓ Case 2: Null metadata handled safely');

  // Case 3: User with missing preferences
  const userNoPrefs = {
    id: 'usr_103',
    name: 'Charlie',
    metadata: { tags: ['dev'] }
  };
  const res3 = formatUserProfile(userNoPrefs);
  assert.strictEqual(res3.theme, 'dark');
  assert.strictEqual(res3.notificationsEnabled, false);
  console.log('✓ Case 3: Missing preferences handled safely');

  console.log('All tests passed successfully!');
}

try {
  runTests();
  process.exit(0);
} catch (err) {
  console.error('Test Suite Failed:', err.message);
  process.exit(1);
}
