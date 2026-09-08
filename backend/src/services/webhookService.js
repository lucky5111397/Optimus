const crypto = require('crypto');
const Task = require('../models/Task');
const Execution = require('../models/Execution');
const Repository = require('../models/Repository');
const { recordEvent, generateTraceId } = require('./auditService');
const { scrubTokens } = require('../agent/toolExecutors');

// In-memory sliding-window cache for replay protection with 10-minute TTL
const recentDeliveryIds = new Map();
const DELIVERY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Periodically purge stale delivery GUIDs.
 */
function cleanupDeliveryCache() {
  const now = Date.now();
  for (const [id, timestamp] of recentDeliveryIds.entries()) {
    if (now - timestamp > DELIVERY_CACHE_TTL_MS) {
      recentDeliveryIds.delete(id);
    }
  }
}

/**
 * Check if a delivery ID has already been processed (replay defense).
 */
function isDuplicateDelivery(deliveryGuid) {
  if (!deliveryGuid || typeof deliveryGuid !== 'string') return false;
  cleanupDeliveryCache();

  if (recentDeliveryIds.has(deliveryGuid)) {
    return true;
  }
  recentDeliveryIds.set(deliveryGuid, Date.now());
  return false;
}

/**
 * Clear delivery cache (primarily for tests).
 */
function resetDeliveryCache() {
  recentDeliveryIds.clear();
}

/**
 * Validates GitHub HMAC SHA-256 signature against request raw body.
 * Prevents timing attacks using crypto.timingSafeEqual.
 */
function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) {
    return false;
  }

  if (typeof signatureHeader !== 'string' || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const providedSignature = signatureHeader.substring(7); // remove 'sha256='
  if (!/^[0-9a-fA-F]{64}$/.test(providedSignature)) {
    return false;
  }

  try {
    const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '', 'utf8');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBuffer);
    const calculatedSignature = hmac.digest('hex');

    const providedBuf = Buffer.from(providedSignature, 'hex');
    const calculatedBuf = Buffer.from(calculatedSignature, 'hex');

    if (providedBuf.length !== calculatedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedBuf, calculatedBuf);
  } catch (err) {
    console.error('[Webhook] Signature verification error:', scrubTokens(err.message));
    return false;
  }
}

/**
 * Handles GitHub ping event (sent upon webhook creation/configuration).
 */
function handlePingEvent(payload) {
  const zen = payload?.zen || 'Practicality beats purity.';
  const hookId = payload?.hook_id;
  return {
    status: 'ok',
    message: 'Pong! Webhook successfully received and verified.',
    zen,
    hookId
  };
}

/**
 * Handles GitHub pull_request events (opened, closed, merged, reopened, synchronize).
 */
async function handlePullRequestEvent(payload) {
  const action = payload.action;
  const pr = payload.pull_request;
  const repoMeta = payload.repository;

  if (!pr || !repoMeta) {
    return { status: 'ignored', reason: 'Missing pull_request or repository payload data' };
  }

  const repoOwner = repoMeta.owner?.login;
  const repoName = repoMeta.name;
  const prNumber = pr.number || payload.number;
  const headBranch = pr.head?.ref;
  const isMerged = Boolean(pr.merged);
  const prState = isMerged ? 'merged' : (pr.state || (action === 'closed' ? 'closed' : 'open'));

  // Find matching user-owned repository
  const repos = await Repository.find({
    owner: new RegExp(`^${repoOwner}$`, 'i'),
    name: new RegExp(`^${repoName}$`, 'i')
  });

  if (!repos || repos.length === 0) {
    return { status: 'ignored', reason: `Repository ${repoOwner}/${repoName} not found in Optimus` };
  }

  const repoIds = repos.map(r => r._id);

  // Find task by PR number or delivery branch
  const query = {
    repositoryId: { $in: repoIds },
    $or: [
      { prNumber: prNumber },
      ...(headBranch ? [{ deliveryBranch: headBranch }] : [])
    ]
  };

  const task = await Task.findOne(query).sort({ updatedAt: -1 });
  if (!task) {
    return { status: 'ignored', reason: `No matching task found for PR #${prNumber} on ${repoOwner}/${repoName}` };
  }

  // Update PR metadata
  task.prState = prState;
  task.prUrl = pr.html_url || task.prUrl;
  task.prNumber = prNumber;
  task.deliveryBranch = headBranch || task.deliveryBranch;
  task.mergeableState = pr.mergeable_state || task.mergeableState;

  let auditEventType = 'PR_SYNCHRONIZED';
  let summary = `GitHub PR #${prNumber} synchronized (Action: ${action}, State: ${prState})`;

  if (action === 'closed' && isMerged) {
    task.status = 'MERGED';
    task.prMergedAt = new Date(pr.merged_at || Date.now());
    auditEventType = 'PR_MERGED';
    summary = `GitHub PR #${prNumber} merged into ${pr.base?.ref || 'default branch'}`;
  } else if (action === 'closed' && !isMerged) {
    task.status = 'CLOSED';
    task.prClosedAt = new Date(pr.closed_at || Date.now());
    auditEventType = 'PR_CLOSED';
    summary = `GitHub PR #${prNumber} closed without merge`;
  } else if (action === 'reopened') {
    if (task.status === 'CLOSED') {
      task.status = 'DELIVERED';
    }
    task.prClosedAt = null;
    summary = `GitHub PR #${prNumber} reopened`;
  }

  await task.save();

  // Record audit log event if an execution exists
  const execution = await Execution.findOne({ taskId: task._id }).sort({ createdAt: -1 });
  if (execution) {
    try {
      if (!execution.traceId) {
        execution.traceId = generateTraceId();
        await execution.save().catch(() => {});
      }
      await recordEvent({
        executionId: execution._id,
        taskId: task._id,
        userId: task.userId,
        traceId: execution.traceId,
        eventType: auditEventType,
        status: 'SUCCESS',
        summary,
        metadata: {
          prNumber,
          prState,
          action,
          isMerged,
          headBranch,
          mergedAt: task.prMergedAt,
          closedAt: task.prClosedAt
        }
      });
    } catch (_) {}
  }

  return {
    status: 'processed',
    taskId: task._id,
    taskStatus: task.status,
    prState: task.prState,
    prNumber: task.prNumber
  };
}

/**
 * Handles GitHub check_run and check_suite events for CI/test tracking.
 */
async function handleCheckRunEvent(payload) {
  const checkRun = payload.check_run;
  const repoMeta = payload.repository;

  if (!checkRun || !repoMeta) {
    return { status: 'ignored', reason: 'Missing check_run or repository payload data' };
  }

  const repoOwner = repoMeta.owner?.login;
  const repoName = repoMeta.name;
  const headSha = checkRun.head_sha;
  const checkName = checkRun.name;
  const checkStatus = checkRun.status; // 'queued', 'in_progress', 'completed'
  const conclusion = checkRun.conclusion; // 'success', 'failure', 'neutral', 'cancelled', 'timed_out', etc.

  // Find matching user-owned repository
  const repos = await Repository.find({
    owner: new RegExp(`^${repoOwner}$`, 'i'),
    name: new RegExp(`^${repoName}$`, 'i')
  });

  if (!repos || repos.length === 0) {
    return { status: 'ignored', reason: `Repository ${repoOwner}/${repoName} not found` };
  }

  const repoIds = repos.map(r => r._id);

  // Match task by execution delivery commitSha or active delivery branch
  const executions = await Execution.find({
    repositoryId: { $in: repoIds },
    'delivery.commitSha': headSha
  }).sort({ updatedAt: -1 });

  let task = null;
  let execution = null;

  if (executions && executions.length > 0) {
    execution = executions[0];
    task = await Task.findById(execution.taskId);
  }

  // Fallback: match by active delivered tasks on repository
  if (!task) {
    task = await Task.findOne({
      repositoryId: { $in: repoIds },
      status: { $in: ['DELIVERED', 'MERGED', 'VERIFIED'] }
    }).sort({ updatedAt: -1 });

    if (task) {
      execution = await Execution.findOne({ taskId: task._id }).sort({ createdAt: -1 });
    }
  }

  if (!task) {
    return { status: 'ignored', reason: 'No matching task found for commit check run' };
  }

  // Compute aggregate CI status
  let overallCiStatus = task.ciStatus || 'NONE';
  if (conclusion === 'success') {
    overallCiStatus = 'SUCCESS';
  } else if (['failure', 'timed_out', 'action_required'].includes(conclusion)) {
    overallCiStatus = 'FAILURE';
  } else if (['queued', 'in_progress'].includes(checkStatus)) {
    overallCiStatus = 'PENDING';
  } else if (conclusion === 'neutral') {
    overallCiStatus = overallCiStatus === 'NONE' ? 'NEUTRAL' : overallCiStatus;
  }

  task.ciStatus = overallCiStatus;

  // Update check run list in ciDetails
  const currentDetails = task.ciDetails || { checkRuns: [] };
  const checkList = Array.isArray(currentDetails.checkRuns) ? currentDetails.checkRuns : [];

  const existingIdx = checkList.findIndex(c => c.name === checkName);
  const checkEntry = {
    name: checkName,
    status: checkStatus,
    conclusion: conclusion || null,
    htmlUrl: checkRun.html_url || null,
    startedAt: checkRun.started_at || null,
    completedAt: checkRun.completed_at || null,
    updatedAt: new Date()
  };

  if (existingIdx >= 0) {
    checkList[existingIdx] = checkEntry;
  } else {
    checkList.push(checkEntry);
  }

  task.ciDetails = {
    overall: overallCiStatus,
    checkRuns: checkList.slice(-20), // keep last 20
    lastUpdated: new Date()
  };

  await task.save();

  // Audit event
  if (execution) {
    try {
      if (!execution.traceId) {
        execution.traceId = generateTraceId();
        await execution.save().catch(() => {});
      }
      await recordEvent({
        executionId: execution._id,
        taskId: task._id,
        userId: task.userId,
        traceId: execution.traceId,
        eventType: 'CI_CHECK_UPDATED',
        status: conclusion === 'failure' ? 'FAILED' : (conclusion === 'success' ? 'SUCCESS' : 'IN_PROGRESS'),
        summary: `CI Check "${checkName}": ${conclusion || checkStatus}`,
        metadata: {
          checkName,
          checkStatus,
          conclusion,
          overallCiStatus,
          headSha
        }
      });
    } catch (_) {}
  }

  return {
    status: 'processed',
    taskId: task._id,
    ciStatus: task.ciStatus,
    checkName,
    conclusion
  };
}

module.exports = {
  verifyWebhookSignature,
  isDuplicateDelivery,
  resetDeliveryCache,
  handlePingEvent,
  handlePullRequestEvent,
  handleCheckRunEvent
};
