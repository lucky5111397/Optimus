const assert = require('assert');
const { AsyncTaskQueue } = require('./src/queue');

async function runTests() {
  console.log('Running test suite for fixture-02-async-concurrency...');

  const queue = new AsyncTaskQueue(2);
  const executionOrder = [];

  queue.add(async () => {
    await new Promise(r => setTimeout(r, 20));
    executionOrder.push('task1');
    return { id: 1, val: 'alpha' };
  });

  queue.add(async () => {
    await new Promise(r => setTimeout(r, 10));
    executionOrder.push('task2');
    return { id: 2, val: 'beta' };
  });

  queue.add(async () => {
    await new Promise(r => setTimeout(r, 15));
    executionOrder.push('task3');
    return { id: 3, val: 'gamma' };
  });

  const results = await queue.process();

  // Baseline fails here because results is [] when process() returns immediately
  assert(Array.isArray(results), 'Results should be an array');
  assert.strictEqual(results.length, 3, `Expected 3 results, got ${results.length}`);
  assert.deepStrictEqual(results[0], { id: 1, val: 'alpha' });
  assert.deepStrictEqual(results[1], { id: 2, val: 'beta' });
  assert.deepStrictEqual(results[2], { id: 3, val: 'gamma' });
  assert.strictEqual(executionOrder.length, 3, 'All tasks must execute before process completes');

  console.log('✓ All async queue tasks resolved and completed in order');
  console.log('All tests passed successfully!');
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Test Suite Failed:', err.message);
  process.exit(1);
});
