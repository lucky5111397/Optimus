/**
 * Startup and Crash Recovery Service.
 * Reconciles executions and delivery tasks left in unverified or in-progress states
 * due to process crash, server restart, or unhandled worker termination.
 */

const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const Execution = require('../models/Execution');
const Task = require('../models/Task');
const Repository = require('../models/Repository');
const { recordEvent } = require('./auditService');
const { releaseExecutionLock } = require('./executionLock');
const { scrubTokens } = require('../agent/toolExecutors');

const WORKSPACES_DIR = path.resolve(__dirname, '..', '..', 'workspaces');

/**
 * Reconciles any executions and tasks left orphaned or in-flight during previous process run.
 */
async function reconcileStaleExecutions(options = {}) {
  const { gitRollback = true } = options;

  let inFlightExecutions = Execution.find({
    status: { $in: ['QUEUED', 'RUNNING', 'VALIDATING'] }
  });
  if (inFlightExecutions && typeof inFlightExecutions.exec === 'function') {
    inFlightExecutions = await inFlightExecutions.exec();
  } else {
    inFlightExecutions = await inFlightExecutions;
  }
  if (!Array.isArray(inFlightExecutions)) inFlightExecutions = [];

  const recoveredExecutions = [];

  for (const exec of inFlightExecutions) {
    try {
      const taskId = exec.taskId;
      const task = await Task.findById(taskId) || (typeof Task.findOne === 'function' ? await Task.findOne({ _id: taskId }) : null);

      // Record recovery started event
      if (exec.traceId && task) {
        try {
          await recordEvent({
            executionId: exec._id,
            taskId: task._id,
            userId: exec.userId,
            traceId: exec.traceId,
            eventType: 'EXECUTION_RECOVERY_STARTED',
            summary: `Crash recovery initiated for execution ${exec._id} (Stale status: ${exec.status})`,
            metadata: { staleStatus: exec.status, recoveredAt: new Date() }
          });
        } catch (_) {}
      }

      // Safe git rollback on workspace if workspace exists and gitRollback is enabled
      if (gitRollback && exec.repositoryId) {
        const repo = await Repository.findById(exec.repositoryId);
        if (repo) {
          const workspacePath = path.resolve(WORKSPACES_DIR, repo._id.toString());
          try {
            await fs.access(workspacePath);
            await new Promise((resolve) => {
              const p = spawn('git', ['reset', '--hard', 'HEAD'], { cwd: workspacePath, shell: false });
              p.on('close', resolve);
            });
            await new Promise((resolve) => {
              const p = spawn('git', ['clean', '-fd'], { cwd: workspacePath, shell: false });
              p.on('close', resolve);
            });
          } catch (_) {
            // Workspace might not exist or git not initialized
          }
        }
      }

      // Mark execution as FAILED due to crash/restart
      exec.status = 'FAILED';
      exec.error = 'Execution interrupted by server restart or process crash.';
      exec.completedAt = new Date();
      exec.metadata = {
        ...(exec.metadata || {}),
        failureCategory: 'SERVER_RESTART_ORPHANED',
        recoveredAt: new Date()
      };
      await exec.save();

      // Mark task as FAILED if still in active executing state
      if (task && ['IMPLEMENTING', 'TESTING', 'VALIDATING', 'DIAGNOSING', 'RETRYING', 'VERIFYING'].includes(task.status)) {
        task.status = 'FAILED';
        await task.save();
      }

      // Release any abandoned in-memory locks
      releaseExecutionLock(taskId, exec.repositoryId);

      // Record recovery completed event
      if (exec.traceId && task) {
        try {
          await recordEvent({
            executionId: exec._id,
            taskId: task._id,
            userId: exec.userId,
            traceId: exec.traceId,
            eventType: 'EXECUTION_RECOVERY_COMPLETED',
            status: 'FAILED',
            summary: `Crash recovery completed for execution ${exec._id}. Execution marked FAILED and workspace rolled back.`,
            metadata: { recoveredStatus: 'FAILED', previousStatus: exec.status }
          });
        } catch (_) {}
      }

      recoveredExecutions.push(exec._id.toString());

    } catch (err) {
      console.error(`Failed to reconcile execution ${exec._id}:`, scrubTokens(err.message));
    }
  }

  // Reconcile tasks stuck in non-terminal delivery states
  let stuckDeliveryTasks = Task.find({
    $or: [
      { deliveryStatus: { $in: ['PREPARING', 'COMMITTING', 'PUSHING', 'CREATING_PR'] } },
      { status: 'DELIVERING' }
    ]
  });
  if (stuckDeliveryTasks && typeof stuckDeliveryTasks.exec === 'function') {
    stuckDeliveryTasks = await stuckDeliveryTasks.exec();
  } else {
    stuckDeliveryTasks = await stuckDeliveryTasks;
  }
  if (!Array.isArray(stuckDeliveryTasks)) stuckDeliveryTasks = [];

  for (const task of stuckDeliveryTasks) {
    try {
      task.deliveryStatus = 'FAILED';
      task.deliveryError = 'GitHub delivery interrupted by server restart. Ready for retry.';
      if (task.status !== 'DELIVERED') {
        task.status = 'VERIFIED'; // Keep task in VERIFIED state so user can retry delivery
      }
      await task.save();
    } catch (_) {}
  }

  return {
    recoveredCount: recoveredExecutions.length,
    recoveredExecutions: recoveredExecutions.length,
    recoveredDeliveries: stuckDeliveryTasks.length,
    stuckDeliveryTasksCount: stuckDeliveryTasks.length
  };
}

module.exports = {
  reconcileStaleExecutions
};
