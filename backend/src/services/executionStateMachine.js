/**
 * Centralized State Machine for Task and Execution Lifecycles.
 * Strictly validates every state transition to prevent invalid states
 * (e.g. FAILED -> RUNNING, COMPLETED -> RUNNING, VERIFIED -> RUNNING).
 */

const VALID_EXECUTION_TRANSITIONS = {
  QUEUED: new Set(['RUNNING', 'CANCELLED', 'FAILED']),
  RUNNING: new Set(['VALIDATING', 'COMPLETED', 'CANCELLED', 'FAILED']),
  VALIDATING: new Set(['RUNNING', 'COMPLETED', 'CANCELLED', 'FAILED']),
  COMPLETED: new Set([]), // Terminal
  FAILED: new Set([]),    // Terminal
  CANCELLED: new Set([])  // Terminal
};

const VALID_TASK_TRANSITIONS = {
  DRAFT: new Set(['ANALYZING', 'PLANNING']),
  ANALYZING: new Set(['CONTEXT_READY', 'FAILED']),
  CONTEXT_READY: new Set(['PLANNING', 'FAILED']),
  PLANNING: new Set(['PLAN_READY', 'CONTEXT_READY', 'FAILED']),
  PLAN_READY: new Set(['AWAITING_APPROVAL', 'CONTEXT_READY', 'PLANNING', 'FAILED']),
  AWAITING_APPROVAL: new Set(['IMPLEMENTING', 'CONTEXT_READY', 'PLANNING', 'FAILED']),
  IMPLEMENTING: new Set(['TESTING', 'FAILED', 'CANCELLED']),
  TESTING: new Set(['DIAGNOSING', 'RETRYING', 'VERIFYING', 'VERIFIED', 'FAILED', 'CANCELLED']),
  DIAGNOSING: new Set(['RETRYING', 'FAILED', 'CANCELLED']),
  RETRYING: new Set(['VERIFYING', 'TESTING', 'FAILED', 'CANCELLED']),
  VERIFYING: new Set(['DIAGNOSING', 'RETRYING', 'VERIFIED', 'FAILED', 'CANCELLED']),
  VERIFIED: new Set(['DELIVERED', 'FAILED', 'ACCEPTED']),
  ACCEPTED: new Set(['DELIVERED']),
  DELIVERED: new Set([]), // Terminal
  FAILED: new Set(['CONTEXT_READY', 'PLANNING', 'AWAITING_APPROVAL']), // Can re-plan or retry from approved
  CANCELLED: new Set(['CONTEXT_READY', 'AWAITING_APPROVAL'])
};

class InvalidStateTransitionError extends Error {
  constructor(entity, fromStatus, toStatus) {
    super(`Invalid ${entity} state transition: Cannot transition from "${fromStatus}" to "${toStatus}"`);
    this.name = 'InvalidStateTransitionError';
    this.code = 'INVALID_STATE_TRANSITION';
    this.statusCode = 400;
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

/**
 * Validates whether an execution transition is permitted.
 */
function canTransitionExecution(currentStatus, newStatus) {
  if (currentStatus === newStatus) return true;
  const allowed = VALID_EXECUTION_TRANSITIONS[currentStatus];
  return allowed ? allowed.has(newStatus) : false;
}

/**
 * Validates whether a task transition is permitted.
 */
function canTransitionTask(currentStatus, newStatus) {
  if (currentStatus === newStatus) return true;
  const allowed = VALID_TASK_TRANSITIONS[currentStatus];
  return allowed ? allowed.has(newStatus) : false;
}

/**
 * Safely applies an execution transition, throwing if invalid.
 */
async function transitionExecution(execution, newStatus, extraUpdates = {}) {
  const currentStatus = execution.status;
  if (!canTransitionExecution(currentStatus, newStatus)) {
    throw new InvalidStateTransitionError('Execution', currentStatus, newStatus);
  }

  execution.status = newStatus;
  Object.assign(execution, extraUpdates);
  await execution.save();
  return execution;
}

/**
 * Safely applies a task transition, throwing if invalid.
 */
async function transitionTask(task, newStatus, extraUpdates = {}) {
  const currentStatus = task.status;
  if (!canTransitionTask(currentStatus, newStatus)) {
    throw new InvalidStateTransitionError('Task', currentStatus, newStatus);
  }

  task.status = newStatus;
  Object.assign(task, extraUpdates);
  await task.save();
  return task;
}

module.exports = {
  VALID_EXECUTION_TRANSITIONS,
  VALID_TASK_TRANSITIONS,
  InvalidStateTransitionError,
  canTransitionExecution,
  canTransitionTask,
  transitionExecution,
  transitionTask
};
