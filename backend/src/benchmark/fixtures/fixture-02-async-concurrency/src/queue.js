/**
 * Simple asynchronous task queue with concurrency control.
 */
class AsyncTaskQueue {
  constructor(concurrency = 2) {
    this.concurrency = Math.max(1, concurrency);
    this.tasks = [];
    this.results = [];
  }

  /**
   * Adds an async task factory to the queue.
   * @param {Function} taskFn - Function returning a Promise
   */
  add(taskFn) {
    this.tasks.push(taskFn);
  }

  /**
   * Processes all queued tasks and returns results in order.
   * @returns {Promise<Array>}
   */
  async process() {
    this.results = [];

    // BUG: forEach does not await async operations, returning prematurely before any tasks finish!
    this.tasks.forEach(async (taskFn, index) => {
      const res = await taskFn();
      this.results[index] = res;
    });

    return this.results;
  }
}

module.exports = { AsyncTaskQueue };
