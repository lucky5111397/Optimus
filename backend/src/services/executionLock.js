/**
 * Concurrency and Workspace Ownership Lock Registry.
 * Prevents:
 * 1. Double-clicking or duplicate HTTP requests creating concurrent executions for one task.
 * 2. Two executions simultaneously operating on or rolling back the same repository workspace.
 * 3. Stale abandoned locks lingering after timeouts.
 */

const LOCK_TIMEOUT_MS = 300000; // 5 minutes max wall-clock time

// In-memory locks: Map<key, { taskId, repoId, userId, acquiredAt, lastHeartbeat, abortController }>
const activeTaskLocks = new Map();
const activeWorkspaceLocks = new Map();

class ExecutionLockConflictError extends Error {
  constructor(message, lockDetails = {}) {
    super(message);
    this.name = 'ExecutionLockConflictError';
    this.statusCode = 409;
    this.code = lockDetails.code || 'EXECUTION_LOCK_CONFLICT';
    this.lockDetails = lockDetails;
  }
}

/**
 * Acquires both task lock and workspace lock atomically.
 * Automatically detects and clears stale locks.
 */
function acquireExecutionLock(taskId, repoId, userId, abortController = null) {
  const taskKey = taskId.toString();
  const repoKey = repoId.toString();
  const now = Date.now();

  // 1. Check existing task lock
  const existingTaskLock = activeTaskLocks.get(taskKey);
  if (existingTaskLock) {
    const lastBeat = existingTaskLock.lastHeartbeatAt || existingTaskLock.lastHeartbeat;
    if (now - lastBeat > LOCK_TIMEOUT_MS) {
      // Stale lock detected, evict
      activeTaskLocks.delete(taskKey);
    } else {
      throw new ExecutionLockConflictError(
        `Task ${taskId} already has an active execution in progress.`,
        { taskId, acquiredAt: existingTaskLock.acquiredAt, code: 'TASK_ALREADY_EXECUTING' }
      );
    }
  }

  // 2. Check existing workspace lock (prevents cross-task race on the same git working tree)
  const existingWsLock = activeWorkspaceLocks.get(repoKey);
  if (existingWsLock) {
    const lastBeat = existingWsLock.lastHeartbeatAt || existingWsLock.lastHeartbeat;
    if (now - lastBeat > LOCK_TIMEOUT_MS) {
      activeWorkspaceLocks.delete(repoKey);
    } else if (existingWsLock.taskId !== taskKey) {
      throw new ExecutionLockConflictError(
        `Workspace for repository ${repoId} is currently in use by task ${existingWsLock.taskId}.`,
        { repoId, lockedByTask: existingWsLock.taskId, code: 'WORKSPACE_LOCKED' }
      );
    }
  }

  const lockInfo = {
    taskId: taskKey,
    repoId: repoKey,
    userId: userId.toString(),
    acquiredAt: now,
    lastHeartbeat: now,
    lastHeartbeatAt: now,
    abortController
  };

  activeTaskLocks.set(taskKey, lockInfo);
  activeWorkspaceLocks.set(repoKey, lockInfo);

  return lockInfo;
}

/**
 * Updates lock heartbeat to prevent premature staleness evictions.
 */
function heartbeatLock(taskId) {
  const taskKey = taskId.toString();
  const lock = activeTaskLocks.get(taskKey);
  if (lock) {
    const now = Date.now();
    lock.lastHeartbeat = now;
    lock.lastHeartbeatAt = now;
    const wsLock = activeWorkspaceLocks.get(lock.repoId);
    if (wsLock) {
      wsLock.lastHeartbeat = now;
      wsLock.lastHeartbeatAt = now;
    }
  }
}

/**
 * Releases task and workspace locks.
 */
function releaseExecutionLock(taskId, repoId) {
  const taskKey = taskId ? taskId.toString() : null;
  const repoKey = repoId ? repoId.toString() : null;

  if (taskKey) {
    const taskLock = activeTaskLocks.get(taskKey);
    if (taskLock && !repoKey) {
      activeWorkspaceLocks.delete(taskLock.repoId);
    }
    activeTaskLocks.delete(taskKey);
  }

  if (repoKey) {
    activeWorkspaceLocks.delete(repoKey);
  }
}

/**
 * Retrieves the abort controller for an active task lock.
 */
function getActiveAbortController(taskId) {
  const lock = activeTaskLocks.get(taskId.toString());
  return lock ? lock.abortController : null;
}

/**
 * Checks if a task is currently actively executing.
 */
function isTaskExecuting(taskId) {
  if (!taskId) return false;
  const lock = activeTaskLocks.get(taskId.toString());
  if (!lock) return false;
  const lastBeat = lock.lastHeartbeatAt || lock.lastHeartbeat;
  if (Date.now() - lastBeat > LOCK_TIMEOUT_MS) {
    activeTaskLocks.delete(taskId.toString());
    return false;
  }
  return true;
}

/**
 * Checks if a workspace is currently locked by any task.
 */
function isWorkspaceLocked(repoId) {
  if (!repoId) return false;
  const lock = activeWorkspaceLocks.get(repoId.toString());
  if (!lock) return false;
  const lastBeat = lock.lastHeartbeatAt || lock.lastHeartbeat;
  if (Date.now() - lastBeat > LOCK_TIMEOUT_MS) {
    activeWorkspaceLocks.delete(repoId.toString());
    return false;
  }
  return true;
}

/**
 * Clears all active locks (useful for test resets or recovery).
 */
function clearAllLocks() {
  activeTaskLocks.clear();
  activeWorkspaceLocks.clear();
}

const activeLocks = {
  tasks: activeTaskLocks,
  workspaces: activeWorkspaceLocks
};

module.exports = {
  acquireExecutionLock,
  heartbeatLock,
  releaseExecutionLock,
  getActiveAbortController,
  isTaskExecuting,
  isWorkspaceLocked,
  clearAllLocks,
  activeLocks,
  ExecutionLockConflictError,
  activeTaskLocks,
  activeWorkspaceLocks
};
