const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');
const Task = require('../models/Task');
const TaskPlan = require('../models/TaskPlan');
const Execution = require('../models/Execution');
const Repository = require('../models/Repository');
const RepositoryBranch = require('../models/RepositoryBranch');
const User = require('../models/User');
const { isSensitivePath } = require('../ai/prompts');
const { scrubTokens } = require('../agent/toolExecutors');

const WORKSPACES_DIR = path.resolve(__dirname, '..', '..', 'workspaces');

// In-flight concurrency lock to prevent duplicate delivery requests
const activeDeliveries = new Set();

/**
 * Typed GitHub API Errors for clean classification and resilience.
 */
class GitHubError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = options.statusCode || 500;
    this.isRetryable = options.isRetryable !== undefined ? options.isRetryable : false;
  }
}

class GitHubAuthenticationError extends GitHubError {
  constructor(message = 'GitHub Authentication Error (401): Bad credentials or expired token.') {
    super(message, { statusCode: 401, isRetryable: false });
  }
}

class GitHubPermissionError extends GitHubError {
  constructor(message = 'GitHub Permission Error (403): Missing repository access permissions.') {
    super(message, { statusCode: 403, isRetryable: false });
  }
}

class GitHubNotFoundError extends GitHubError {
  constructor(message = 'GitHub Resource Not Found (404).') {
    super(message, { statusCode: 404, isRetryable: false });
  }
}

class GitHubConflictError extends GitHubError {
  constructor(message = 'GitHub Conflict (409): Branch conflict or merge conflict.') {
    super(message, { statusCode: 409, isRetryable: false });
  }
}

class GitHubValidationError extends GitHubError {
  constructor(message = 'GitHub Validation Error (422).', options = {}) {
    super(message, { statusCode: 422, isRetryable: false });
    this.rawErrors = options.rawErrors || [];
  }
}

class GitHubRateLimitError extends GitHubError {
  constructor(message = 'GitHub Rate Limit Exceeded (429).') {
    super(message, { statusCode: 429, isRetryable: true });
  }
}

class GitHubProviderError extends GitHubError {
  constructor(message = 'GitHub Server Error (5xx).') {
    super(message, { statusCode: 502, isRetryable: true });
  }
}

/**
 * Resilient GitHub API client with bounded retry for transient network & rate limit failures.
 */
async function callGithubApiWithRetry(apiFn, maxRetries = 2) {
  let attempts = 0;
  let lastError = null;

  while (attempts <= maxRetries) {
    attempts++;
    try {
      return await apiFn();
    } catch (err) {
      let normalizedError;
      const status = err.response?.status;
      const rawMsg = err.response?.data?.message || err.message || 'GitHub API error';
      const cleanMsg = scrubTokens(rawMsg);

      if (status === 401) {
        normalizedError = new GitHubAuthenticationError(`GitHub Authentication Error (401): ${cleanMsg}`);
      } else if (status === 403) {
        const rateLimitRemaining = err.response?.headers?.['x-ratelimit-remaining'];
        if (rateLimitRemaining === '0' || cleanMsg.toLowerCase().includes('rate limit')) {
          normalizedError = new GitHubRateLimitError(`GitHub Rate Limit Exceeded (403): ${cleanMsg}`);
        } else {
          normalizedError = new GitHubPermissionError(`GitHub Permission Error (403): ${cleanMsg}`);
        }
      } else if (status === 404) {
        normalizedError = new GitHubNotFoundError(`GitHub Resource Not Found (404): ${cleanMsg}`);
      } else if (status === 409) {
        normalizedError = new GitHubConflictError(`GitHub Conflict (409): ${cleanMsg}`);
      } else if (status === 422) {
        normalizedError = new GitHubValidationError(`GitHub Validation Error (422): ${cleanMsg}`, {
          rawErrors: err.response?.data?.errors
        });
      } else if (status === 429) {
        normalizedError = new GitHubRateLimitError(`GitHub Rate Limit Exceeded (429): ${cleanMsg}`);
      } else if (status >= 500) {
        normalizedError = new GitHubProviderError(`GitHub Server Error (${status}): ${cleanMsg}`);
      } else {
        normalizedError = new GitHubError(`GitHub API Failed (${status || 500}): ${cleanMsg}`, { statusCode: status || 500 });
      }

      lastError = normalizedError;

      // Only retry transient errors (5xx, 429, network timeouts)
      if (attempts <= maxRetries && normalizedError.isRetryable) {
        const delay = Math.min(500 * Math.pow(2, attempts - 1), 2000);
        await new Promise(res => setTimeout(res, delay));
        continue;
      }
      break;
    }
  }

  throw lastError;
}

/**
 * Emits a sanitized delivery lifecycle event and persists it to execution and task.
 */
async function emitDeliveryEvent(execution, task, eventName, details = {}) {
  const cleanDetails = {};
  for (const [k, v] of Object.entries(details)) {
    cleanDetails[k] = typeof v === 'string' ? scrubTokens(v) : v;
  }

  const eventObj = {
    event: eventName,
    timestamp: new Date(),
    details: cleanDetails
  };

  if (!execution.delivery) execution.delivery = {};
  if (!Array.isArray(execution.delivery.events)) execution.delivery.events = [];
  execution.delivery.events.push(eventObj);

  const summary = Object.entries(cleanDetails).map(([k, v]) => `${k}: ${v}`).join(', ');
  const logText = `[Delivery Event] ${eventName}${summary ? ` (${summary})` : ''}`;

  if (!Array.isArray(execution.executionLogs)) execution.executionLogs = [];
  execution.executionLogs.push({
    timestamp: new Date(),
    stream: 'system',
    text: scrubTokens(logText).substring(0, 4000)
  });

  if (task) {
    task.deliveryStatus = execution.delivery.status || task.deliveryStatus;
    await task.save().catch(() => {});
  }
  await execution.save().catch(() => {});
}

/**
 * Validates workspace path strictly to prevent directory traversal outside WORKSPACES_DIR.
 */
function validateWorkspaceContainment(repoIdStr) {
  if (!repoIdStr || typeof repoIdStr !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(repoIdStr)) {
    throw new Error('Invalid repository ID for workspace path');
  }

  const backendWorkspaces = path.resolve(__dirname, '..', '..', 'workspaces');
  const rootWorkspaces = path.resolve(__dirname, '..', '..', '..', 'workspaces');

  let targetRoot = backendWorkspaces;
  try {
    const rootCandidate = path.resolve(rootWorkspaces, repoIdStr);
    if (require('fs').existsSync(path.join(rootCandidate, '.git'))) {
      targetRoot = rootWorkspaces;
    }
  } catch (_) {}

  const resolvedRoot = path.resolve(targetRoot);
  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  const workspacePath = path.resolve(resolvedRoot, repoIdStr);

  if (workspacePath !== resolvedRoot && !workspacePath.startsWith(rootWithSep)) {
    throw new Error('Directory traversal detected in workspace path');
  }

  return workspacePath;
}

/**
 * Validates git branch names to prevent command and argument injection.
 */
function validateBranchName(branchName) {
  if (!branchName || typeof branchName !== 'string') return false;
  if (!/^[a-zA-Z0-9._\-\/]+$/.test(branchName)) return false;
  if (branchName.startsWith('-') || branchName.startsWith('/')) return false;
  if (branchName.endsWith('/') || branchName.endsWith('.') || branchName.endsWith('.lock')) return false;
  if (branchName.includes('..') || branchName.includes('//')) return false;
  if (branchName.length < 1 || branchName.length > 200) return false;
  return true;
}

/**
 * Safely executes git commands with shell disabled and scrubbed error output.
 */
function spawnGit(args, options = {}) {
  return new Promise((resolve, reject) => {
    const safeOptions = { ...options, shell: false };
    const proc = spawn('git', args, safeOptions);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(scrubTokens(err.message)));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        const cleanErr = scrubTokens(stderr.trim() || stdout.trim() || `Process exited with code ${code}`);
        reject(new Error(cleanErr));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * Inspects the git working tree for changed, added, modified, and deleted files.
 */
async function inspectWorkingTree(workspacePath) {
  const { stdout } = await spawnGit(['status', '--porcelain'], { cwd: workspacePath });
  const lines = stdout.split('\n').filter(Boolean);
  const changedFiles = [];
  const untrackedFiles = [];
  const sensitiveFiles = [];

  for (const line of lines) {
    if (line.length < 3) continue;
    const code = line.substring(0, 2);
    const rawPath = line.substring(3).trim();
    let filePath = rawPath;
    let status = 'modified';

    if (code.includes('?')) {
      status = 'added';
      untrackedFiles.push(rawPath);
    } else if (code.includes('A')) {
      status = 'added';
    } else if (code.includes('D')) {
      status = 'deleted';
    } else if (code.includes('R')) {
      status = 'renamed';
      const parts = rawPath.split(' -> ');
      filePath = parts[1] || parts[0];
    } else if (code.includes('M')) {
      status = 'modified';
    }

    if (isSensitivePath(filePath)) {
      sensitiveFiles.push(filePath);
    }

    changedFiles.push({ path: filePath, status });
  }

  // If there are safe untracked files, mark them with intent-to-add so git diff includes them
  const safeUntracked = untrackedFiles.filter(p => !isSensitivePath(p));
  if (safeUntracked.length > 0) {
    try {
      await spawnGit(['add', '-N', '--', ...safeUntracked], { cwd: workspacePath });
    } catch (_) {
      // Ignore if intent-to-add is not supported or fails
    }
  }

  // Get diff output
  let diff = '';
  let diffStat = '';
  try {
    const diffRes = await spawnGit(['diff', 'HEAD'], { cwd: workspacePath });
    diff = diffRes.stdout || '';
  } catch (_) {
    // If no HEAD yet, try plain git diff
    try {
      const diffRes = await spawnGit(['diff'], { cwd: workspacePath });
      diff = diffRes.stdout || '';
    } catch (e) {
      diff = '';
    }
  }

  try {
    const statRes = await spawnGit(['diff', '--stat', 'HEAD'], { cwd: workspacePath });
    diffStat = statRes.stdout || '';
  } catch (_) {
    try {
      const statRes = await spawnGit(['diff', '--stat'], { cwd: workspacePath });
      diffStat = statRes.stdout || '';
    } catch (e) {
      diffStat = '';
    }
  }

  // Compute additions and deletions from diff
  let totalAdditions = 0;
  let totalDeletions = 0;
  const diffLines = diff.split('\n');
  for (const dLine of diffLines) {
    if (dLine.startsWith('+') && !dLine.startsWith('+++')) totalAdditions++;
    else if (dLine.startsWith('-') && !dLine.startsWith('---')) totalDeletions++;
  }

  return {
    changedFiles,
    sensitiveFiles,
    diff: scrubTokens(diff),
    diffStat: scrubTokens(diffStat.trim()),
    totalAdditions,
    totalDeletions
  };
}

/**
 * Generates or retrieves execution review data and delivery readiness status.
 */
async function generateExecutionReview(taskId, userId) {
  const task = await Task.findOne({ _id: taskId, userId }).populate('repositoryId');
  if (!task) {
    const error = new Error('Task not found');
    error.statusCode = 404;
    throw error;
  }

  const repo = await Repository.findOne({ _id: task.repositoryId._id, userId });
  if (!repo) {
    const error = new Error('Repository access denied');
    error.statusCode = 403;
    throw error;
  }

  const execution = await Execution.findOne({ taskId: task._id }).sort({ createdAt: -1 });
  if (!execution) {
    const error = new Error('No execution found for this task');
    error.statusCode = 404;
    throw error;
  }

  const plan = await TaskPlan.findOne({ taskId: task._id });

  const reasonsNotReady = [];

  // 1. Task state check
  if (task.status !== 'VERIFIED' && task.status !== 'DELIVERED') {
    reasonsNotReady.push(`Task status is ${task.status} (must be VERIFIED)`);
  }

  // 2. Execution state check
  if (execution.status !== 'COMPLETED') {
    reasonsNotReady.push(`Execution status is ${execution.status} (must be COMPLETED)`);
  }

  // 3. Plan integrity check
  if (!plan) {
    reasonsNotReady.push('No implementation plan exists for this task');
  } else if (!task.approvedPlanHash || task.approvedPlanHash !== plan.planHash) {
    reasonsNotReady.push('Plan integrity check failed: current plan has not been approved');
  }

  // 4. Validation results check
  if (!execution.validationResults || execution.validationResults.status !== 'PASSED') {
    reasonsNotReady.push('Execution validation has not passed');
  }

  // 5. Workspace validation
  let workspacePath;
  let workingTree = {
    changedFiles: [],
    sensitiveFiles: [],
    diff: '',
    diffStat: '',
    totalAdditions: 0,
    totalDeletions: 0
  };

  try {
    workspacePath = validateWorkspaceContainment(repo._id.toString());
    await fs.access(path.join(workspacePath, '.git'));
    workingTree = await inspectWorkingTree(workspacePath);

    if (workingTree.sensitiveFiles.length > 0) {
      reasonsNotReady.push(`Sensitive files detected in workspace: ${workingTree.sensitiveFiles.join(', ')}`);
    }
  } catch (wsErr) {
    reasonsNotReady.push(`Workspace inspection failed: ${wsErr.message}`);
  }

  // 6. User GitHub token check
  const user = await User.findById(userId);
  if (!user || !user.accessToken) {
    reasonsNotReady.push('User GitHub access token is missing');
  }

  let defaultBranchDoc = null;
  try {
    defaultBranchDoc = await RepositoryBranch.findOne({ repositoryId: repo._id, isDefault: true });
  } catch (_) {}
  const targetBranch = (defaultBranchDoc && defaultBranchDoc.name) || repo.defaultBranch || 'main';
  const branchName = `optimus-task-${task._id}`;

  const readyForDelivery = reasonsNotReady.length === 0 && task.status !== 'DELIVERED';

  // Persist review data in Execution
  execution.review = {
    status: task.status === 'DELIVERED' ? 'DELIVERED' : (readyForDelivery ? 'READY' : 'PENDING'),
    filesChanged: workingTree.changedFiles,
    totalAdditions: workingTree.totalAdditions,
    totalDeletions: workingTree.totalDeletions,
    diffStat: workingTree.diffStat,
    diff: workingTree.diff,
    validationResults: execution.validationResults,
    generatedAt: new Date(),
    reviewedAt: execution.review?.reviewedAt || (readyForDelivery ? new Date() : null)
  };
  await execution.save();

  const deliveryStatus = execution.delivery?.status || (task.status === 'DELIVERED' ? 'DELIVERED' : (readyForDelivery ? 'READY' : 'NOT_STARTED'));

  return {
    taskId: task._id,
    taskTitle: task.title,
    taskStatus: task.status,
    executionStatus: execution.status,
    readyForDelivery,
    reasonsNotReady,
    filesChanged: workingTree.changedFiles,
    totalAdditions: workingTree.totalAdditions,
    totalDeletions: workingTree.totalDeletions,
    diffStat: workingTree.diffStat,
    diff: workingTree.diff,
    validationResults: execution.validationResults,
    branchName,
    targetBranch,
    isDelivered: task.status === 'DELIVERED',
    prUrl: task.prUrl || null,
    prNumber: task.prNumber || null,
    deliveryBranch: task.deliveryBranch || null,
    deliveredAt: task.deliveredAt || null,
    deliveryStatus,
    deliveryEvents: execution.delivery?.events || [],
    commitSha: execution.delivery?.commitSha || null,
    deliveryError: execution.delivery?.error || task.deliveryError || null
  };
}

/**
 * Delivers a verified task to GitHub with multi-stage transaction safety,
 * idempotent branch & PR management, and structured lifecycle events.
 */
async function deliverTaskToGithub(taskId, userId) {
  const lockKey = taskId.toString();
  if (activeDeliveries.has(lockKey)) {
    const error = new Error('Delivery is already in progress for this task');
    error.statusCode = 409;
    throw error;
  }
  activeDeliveries.add(lockKey);

  try {
    const task = await Task.findOne({ _id: taskId, userId }).populate('repositoryId');
    if (!task || (task.userId && task.userId.toString() !== userId.toString())) {
      const error = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }

    // Idempotency check: if already delivered, return existing PR metadata directly
    if (task.status === 'DELIVERED' && task.prUrl) {
      return {
        message: 'Task already delivered',
        prUrl: task.prUrl,
        prNumber: task.prNumber,
        deliveryBranch: task.deliveryBranch,
        alreadyDelivered: true,
        deliveryState: 'DELIVERED'
      };
    }

    // Gate Check 1: Task status must be VERIFIED
    if (task.status !== 'VERIFIED') {
      const error = new Error(`Task is not in VERIFIED state (current: ${task.status})`);
      error.statusCode = 400;
      throw error;
    }

    const repo = await Repository.findOne({ _id: task.repositoryId._id, userId });
    if (!repo) {
      const error = new Error('Repository access denied');
      error.statusCode = 403;
      throw error;
    }

    // Gate Check 2: Execution must be COMPLETED
    const execution = await Execution.findOne({ taskId: task._id, status: 'COMPLETED' });
    if (!execution) {
      const error = new Error('Execution is not completed');
      error.statusCode = 400;
      throw error;
    }

    // Gate Check 3: Execution must belong to the same task, repo, and user
    if (execution.repositoryId.toString() !== repo._id.toString() || execution.userId.toString() !== userId.toString()) {
      const error = new Error('Execution workspace or user mismatch');
      error.statusCode = 403;
      throw error;
    }

    // Gate Check 4: Plan integrity check
    const plan = await TaskPlan.findOne({ taskId: task._id });
    if (!plan) {
      const error = new Error('Cannot deliver task without a generated plan');
      error.statusCode = 400;
      throw error;
    }
    if (!task.approvedPlanHash || task.approvedPlanHash !== plan.planHash) {
      const error = new Error('Plan integrity verification failed: approved plan hash does not match current plan');
      error.statusCode = 403;
      throw error;
    }

    // Gate Check 5: Validation passed
    if (!execution.validationResults || execution.validationResults.status !== 'PASSED') {
      const error = new Error('Execution validation results indicate failure');
      error.statusCode = 400;
      throw error;
    }

    // Gate Check 6: User GitHub access token
    const user = await User.findById(userId);
    if (!user || !user.accessToken) {
      const error = new Error('GitHub access token missing');
      error.statusCode = 403;
      throw error;
    }

    // Gate Check 7: Workspace containment and existence
    const workspacePath = validateWorkspaceContainment(repo._id.toString());
    try {
      await fs.access(path.join(workspacePath, '.git'));
    } catch (_) {
      const error = new Error('Repository workspace .git directory is missing on disk');
      error.statusCode = 500;
      throw error;
    }

    // Inspect working tree changes
    const workingTree = await inspectWorkingTree(workspacePath);

    // Gate Check 8: Sensitive files detection
    if (workingTree.sensitiveFiles.length > 0) {
      const error = new Error(`Cannot deliver: sensitive files detected in working tree (${workingTree.sensitiveFiles.join(', ')})`);
      error.statusCode = 400;
      throw error;
    }

    // Determine and validate branch names
    const branchName = `optimus-task-${task._id}`;
    if (!validateBranchName(branchName)) {
      const error = new Error('Invalid branch name generated');
      error.statusCode = 400;
      throw error;
    }

    let defaultBranchDoc = null;
    try {
      defaultBranchDoc = await RepositoryBranch.findOne({ repositoryId: repo._id, isDefault: true });
    } catch (_) {}
    const targetBranch = (defaultBranchDoc && defaultBranchDoc.name) || repo.defaultBranch || 'main';
    if (!validateBranchName(targetBranch)) {
      const error = new Error('Invalid target repository default branch');
      error.statusCode = 400;
      throw error;
    }

    if (branchName === targetBranch) {
      const error = new Error('Cannot deliver directly to default branch');
      error.statusCode = 400;
      throw error;
    }

    // =========================================================================
    // STAGE 1: PREPARING
    // =========================================================================
    execution.delivery = {
      status: 'PREPARING',
      branch: branchName,
      targetBranch,
      startedAt: new Date(),
      attempts: (execution.delivery?.attempts || 0) + 1,
      events: execution.delivery?.events || []
    };
    task.deliveryStatus = 'PREPARING';
    await emitDeliveryEvent(execution, task, 'delivery_started', { taskId: task._id });
    await emitDeliveryEvent(execution, task, 'branch_prepared', { branch: branchName, targetBranch });

    // =========================================================================
    // STAGE 2: COMMITTING
    // =========================================================================
    execution.delivery.status = 'COMMITTING';
    task.deliveryStatus = 'COMMITTING';
    await execution.save();

    // Switch to execution branch
    await spawnGit(['checkout', '-B', branchName], { cwd: workspacePath });

    // Stage safe changed files
    const safeFilesToStage = workingTree.changedFiles
      .filter(f => !isSensitivePath(f.path))
      .map(f => f.path);

    if (safeFilesToStage.length > 0) {
      await spawnGit(['add', '--', ...safeFilesToStage], { cwd: workspacePath });
    }

    // Check if there are staged changes to commit or if commit already exists
    const stagedCheck = await spawnGit(['diff', '--cached', '--name-only'], { cwd: workspacePath });
    const hasStagedChanges = stagedCheck.stdout.trim().length > 0;
    let commitSha = null;

    if (hasStagedChanges) {
      const safeTitle = scrubTokens(task.title.replace(/[\r\n]+/g, ' ').substring(0, 72));
      const commitArgs = [
        '-c', 'user.name=OPTIMUS Agent',
        '-c', 'user.email=optimus@optimus.ai',
        'commit',
        '-m', `OPTIMUS: ${safeTitle}`
      ];
      await spawnGit(commitArgs, { cwd: workspacePath });
      const { stdout: headSha } = await spawnGit(['rev-parse', 'HEAD'], { cwd: workspacePath });
      commitSha = headSha.trim();
      await emitDeliveryEvent(execution, task, 'commit_created', { commitSha, branch: branchName, newCommit: true });
    } else {
      // Re-use existing commit from prior attempt
      try {
        const { stdout: headSha } = await spawnGit(['rev-parse', 'HEAD'], { cwd: workspacePath });
        commitSha = headSha.trim();
        await emitDeliveryEvent(execution, task, 'commit_created', { commitSha, branch: branchName, reused: true });
      } catch (_) {
        commitSha = 'UNKNOWN';
      }
    }

    execution.delivery.commitSha = commitSha;
    await execution.save();

    // =========================================================================
    // STAGE 3: PUSHING
    // =========================================================================
    execution.delivery.status = 'PUSHING';
    task.deliveryStatus = 'PUSHING';
    await emitDeliveryEvent(execution, task, 'push_started', { branch: branchName });

    // Push branch securely using credential helper without exposing tokens in arguments or URLs
    const gitHelperArgs = [
      '-c', 'credential.helper=',
      '-c', 'credential.helper=!f() { echo username=oauth2; echo "password=$GITHUB_TOKEN"; }; f',
      'push',
      '-u',
      'origin',
      branchName
    ];

    try {
      await spawnGit(gitHelperArgs, {
        cwd: workspacePath,
        env: { ...process.env, GITHUB_TOKEN: user.accessToken }
      });
      execution.delivery.pushStatus = 'SUCCESS';
      await emitDeliveryEvent(execution, task, 'push_completed', { branch: branchName });
    } catch (pushErr) {
      execution.delivery.pushStatus = 'FAILED';
      throw pushErr;
    }

    // =========================================================================
    // STAGE 4: CREATING PULL REQUEST
    // =========================================================================
    execution.delivery.status = 'CREATING_PR';
    task.deliveryStatus = 'CREATING_PR';
    await emitDeliveryEvent(execution, task, 'pr_creation_started', { branch: branchName, targetBranch });

    // Construct Pull Request content safely
    const safeOwner = repo.owner.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeName = repo.name.replace(/[^a-zA-Z0-9_.-]/g, '');
    const safeTitle = scrubTokens(task.title.replace(/[\r\n]+/g, ' ').substring(0, 100));
    const safeDescription = scrubTokens(task.description || 'No detailed task description provided.');

    const validationRunsSummary = (execution.validationResults?.runs || [])
      .map(r => `- \`${r.command}\`: Exit Code ${r.exitCode} (${r.durationMs || 0}ms)`)
      .join('\n');

    const prBody = [
      '## OPTIMUS Autonomous PR',
      '',
      '### Task Overview',
      `**Title**: ${safeTitle}`,
      '',
      safeDescription,
      '',
      '### Implementation Summary',
      `- **Approach**: ${plan.approach || 'Automated implementation via agentic execution.'}`,
      `- **Files Affected**: ${workingTree.changedFiles.map(f => `\`${f.path}\``).join(', ') || 'None'}`,
      `- **Total Additions**: +${workingTree.totalAdditions}`,
      `- **Total Deletions**: -${workingTree.totalDeletions}`,
      '',
      '### Validation Results',
      `- **Status**: PASSED`,
      `- **Attempts**: ${execution.validationResults?.attempts || 1}`,
      validationRunsSummary || '- Default checks verified.',
      '',
      '---',
      '*Generated and verified automatically by OPTIMUS.*'
    ].join('\n');

    const prData = {
      title: `OPTIMUS: ${safeTitle}`,
      body: prBody,
      head: branchName,
      base: targetBranch
    };

    let createdPr = null;

    try {
      const response = await callGithubApiWithRetry(() => axios.post(
        `https://api.github.com/repos/${safeOwner}/${safeName}/pulls`,
        prData,
        {
          headers: {
            Authorization: `Bearer ${user.accessToken}`,
            Accept: 'application/vnd.github.v3+json'
          }
        }
      ));
      createdPr = response.data;
    } catch (apiError) {
      // Handle PR already exists (422) idempotently
      const isAlreadyExists = apiError.statusCode === 422 &&
        (apiError.message.includes('A pull request already exists') || (apiError.rawErrors || []).some(e => (e.message || '').includes('A pull request already exists')));

      if (isAlreadyExists) {
        try {
          const existingPullsRes = await axios.get(
            `https://api.github.com/repos/${safeOwner}/${safeName}/pulls?head=${safeOwner}:${branchName}&state=all`,
            {
              headers: {
                Authorization: `Bearer ${user.accessToken}`,
                Accept: 'application/vnd.github.v3+json'
              }
            }
          );
          if (existingPullsRes.data && existingPullsRes.data.length > 0) {
            createdPr = existingPullsRes.data[0];
          }
        } catch (_) {}
      }

      if (!createdPr) {
        throw apiError;
      }
    }

    await emitDeliveryEvent(execution, task, 'pr_created', {
      prNumber: createdPr.number,
      prUrl: createdPr.html_url
    });

    // =========================================================================
    // STAGE 5: DELIVERED
    // =========================================================================
    execution.delivery.status = 'DELIVERED';
    execution.delivery.prNumber = createdPr.number;
    execution.delivery.prUrl = createdPr.html_url;
    execution.delivery.completedAt = new Date();
    if (execution.review) {
      execution.review.status = 'DELIVERED';
    }
    await execution.save();

    task.status = 'DELIVERED';
    task.deliveryStatus = 'DELIVERED';
    task.prUrl = createdPr.html_url;
    task.prNumber = createdPr.number;
    task.deliveryBranch = branchName;
    task.deliveredAt = new Date();
    task.deliveryError = null;
    await task.save();

    await emitDeliveryEvent(execution, task, 'delivery_completed', {
      prNumber: createdPr.number,
      prUrl: createdPr.html_url
    });

    return {
      message: 'PR created successfully',
      prUrl: task.prUrl,
      prNumber: task.prNumber,
      deliveryBranch: branchName,
      deliveryState: 'DELIVERED'
    };

  } catch (error) {
    const sanitizedErrorMsg = scrubTokens(error.message || 'Delivery failed');
    const failureCategory = error.name || 'DeliveryFailure';

    try {
      const execution = await Execution.findOne({ taskId });
      const task = await Task.findById(taskId);
      if (execution) {
        if (!execution.delivery) execution.delivery = {};
        execution.delivery.status = 'FAILED';
        execution.delivery.error = sanitizedErrorMsg;
        execution.delivery.failureCategory = failureCategory;
        if (task) {
          task.deliveryStatus = 'FAILED';
          task.deliveryError = sanitizedErrorMsg;
          await task.save().catch(() => {});
        }
        await emitDeliveryEvent(execution, task, 'delivery_failed', { error: sanitizedErrorMsg, category: failureCategory });
      }
    } catch (_) {}

    error.message = sanitizedErrorMsg;
    throw error;
  } finally {
    activeDeliveries.delete(lockKey);
  }
}

module.exports = {
  validateWorkspaceContainment,
  validateBranchName,
  spawnGit,
  inspectWorkingTree,
  generateExecutionReview,
  deliverTaskToGithub,
  callGithubApiWithRetry,
  emitDeliveryEvent,
  GitHubError,
  GitHubAuthenticationError,
  GitHubPermissionError,
  GitHubNotFoundError,
  GitHubConflictError,
  GitHubValidationError,
  GitHubRateLimitError,
  GitHubProviderError
};
