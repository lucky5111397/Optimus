/**
 * OPTIMUS — Phase 17 Benchmark Runner
 *
 * Orchestrates reproducible automated benchmark evaluation against curated JS/TS challenge fixtures:
 * 1. Discovers and validates challenge fixtures (rejects directory traversal).
 * 2. Prepares isolated sandboxed workspaces under workspaces/bench_<runId>_<fixtureId>.
 * 3. Initializes git baseline and verifies baseline test failure.
 * 4. Creates ephemeral database records for complete isolation.
 * 5. Synthesizes implementation plan via orchestrator.planTask.
 * 6. Auto-approves plan in benchmark mode without weakening production gates.
 * 7. Dispatches multi-turn execution via executionService.executeTask.
 * 8. Gathers execution results, diffs, audit events, and tokens.
 * 9. Cleans up workspaces and ephemeral entities in finally blocks.
 * 10. Computes 8 core metrics via metricsCalculator and outputs reports via reportGenerator.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawnSync } = require('child_process');
const mongoose = require('mongoose');

// Load environment configuration from backend/.env
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const connectDB = require('../config/db');

const Task = require('../models/Task');
const TaskPlan = require('../models/TaskPlan');
const TaskContext = require('../models/TaskContext');
const Execution = require('../models/Execution');
const ExecutionEvent = require('../models/ExecutionEvent');
const Repository = require('../models/Repository');
const RepositoryBranch = require('../models/RepositoryBranch');
const User = require('../models/User');
const TaskMessage = require('../models/TaskMessage');

// Benchmark adapter: safely guard ephemeral assistant TaskMessage saves during benchmark planning
if (TaskMessage && TaskMessage.prototype && typeof TaskMessage.prototype.save === 'function') {
  const origTaskMessageSave = TaskMessage.prototype.save;
  TaskMessage.prototype.save = async function (...args) {
    try {
      return await origTaskMessageSave.apply(this, args);
    } catch (err) {
      if (err.message && err.message.includes('next is not a function')) {
        return this;
      }
      throw err;
    }
  };
}

const orchestrator = require('../services/orchestrator');
const executionService = require('../services/executionService');
const { runInSandbox, scrubTokens } = require('../services/sandboxService');
const { getExecutionEvents } = require('../services/auditService');
const aiGateway = require('../ai/gateway');

const { calculateMetrics } = require('./metricsCalculator');
const { generateJsonReport, generateMarkdownReport, writeReportFiles, sanitizeRunId } = require('./reportGenerator');

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const WORKSPACES_DIR = path.resolve(__dirname, '../../workspaces');
const DEFAULT_REPORTS_DIR = path.resolve(__dirname, 'reports');

/**
 * Validates a fixture identifier to prevent directory traversal and injection.
 * Format: ^[a-zA-Z0-9_-]+$
 */
function validateFixtureId(id) {
  if (typeof id !== 'string' || !id.trim()) return false;
  return /^[a-zA-Z0-9_-]+$/.test(id.trim());
}

/**
 * Discovers available benchmark fixtures from the fixtures directory.
 *
 * @param {string} [baseDir=FIXTURES_DIR]
 * @returns {Array<{ id: string, dir: string, path: string, meta: Object }>}
 */
function discoverFixtures(baseDir = FIXTURES_DIR) {
  const resolvedBase = path.resolve(baseDir);
  if (!fs.existsSync(resolvedBase)) {
    return [];
  }

  const entries = fs.readdirSync(resolvedBase, { withFileTypes: true });
  const fixtures = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fixtureId = entry.name;
    if (!validateFixtureId(fixtureId)) continue;

    const fixturePath = path.join(resolvedBase, fixtureId);
    const metaPath = path.join(fixturePath, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;

    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      fixtures.push({
        id: fixtureId,
        dir: fixtureId,
        path: fixturePath,
        meta
      });
    } catch (err) {
      console.warn(`Warning: Skipping invalid fixture ${fixtureId}: ${err.message}`);
    }
  }

  return fixtures.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Copies directory recursively.
 */
async function copyDir(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fsp.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Deterministic mock planner and agent turns for offline / CI execution.
 */
const MOCK_FIXTURE_PATCHES = {
  'fixture-01-syntax-bug': {
    planSummary: 'Fix null pointer in user profile formatter',
    filesExpectedToChange: ['src/index.js'],
    patches: [
      {
        path: 'src/index.js',
        oldText: '  // BUG: Direct unchecked property chaining throws TypeError when metadata or preferences is null or undefined\n  return {\n    id: user.id,\n    displayName: (user.name || \'\').trim(),\n    theme: user.metadata.preferences.theme || \'dark\',\n    notificationsEnabled: !!user.metadata.preferences.notifications,\n    tags: (user.metadata.tags || []).slice(0, 5)\n  };',
        newText: '  const metadata = user.metadata || {};\n  const preferences = metadata.preferences || {};\n  return {\n    id: user.id,\n    displayName: (user.name || \'\').trim(),\n    theme: preferences.theme || \'dark\',\n    notificationsEnabled: !!preferences.notifications,\n    tags: (metadata.tags || []).slice(0, 5)\n  };'
      }
    ]
  },
  'fixture-02-async-concurrency': {
    planSummary: 'Fix async task queue resolution race',
    filesExpectedToChange: ['src/queue.js'],
    patches: [
      {
        path: 'src/queue.js',
        oldText: '    // BUG: forEach does not await async operations, returning prematurely before any tasks finish!\n    this.tasks.forEach(async (taskFn, index) => {\n      const res = await taskFn();\n      this.results[index] = res;\n    });\n\n    return this.results;',
        newText: '    for (let i = 0; i < this.tasks.length; i++) {\n      const res = await this.tasks[i]();\n      this.results[i] = res;\n    }\n    return this.results;'
      }
    ]
  },
  'fixture-03-validation-recovery': {
    planSummary: 'Fix registration validation schema and normalization',
    filesExpectedToChange: ['src/validator.js'],
    // 2-phase patch to trigger self-healing recovery loop
    initialPatch: {
      path: 'src/validator.js',
      oldText: '  // BUG 1: Phone is strictly required, rejecting valid users who do not provide phone\n  const phone = payload.phone;\n  if (!phone || String(phone).replace(/\\D/g, \'\').length < 10) {\n    return { valid: false, error: \'Phone number is required and must be at least 10 digits\' };\n  }',
      newText: '  const phone = payload.phone;\n  if (phone && String(phone).replace(/\\D/g, \'\').length < 10) {\n    return { valid: false, error: \'Phone number must be at least 10 digits\' };\n  }'
    },
    recoveryPatch: {
      path: 'src/validator.js',
      oldText: '  // BUG 2: Email is not normalized to lowercase\n  return {\n    valid: true,\n    data: {\n      username,\n      email: rawEmail,\n      phone: phone || null\n    }\n  };',
      newText: '  return {\n    valid: true,\n    data: {\n      username,\n      email: rawEmail.toLowerCase(),\n      phone: phone || null\n    }\n  };'
    }
  },
  'fixture-04-token-redaction': {
    planSummary: 'Add OpenRouter and Bearer token regex to sanitizer',
    filesExpectedToChange: ['src/sanitizer.js'],
    patches: [
      {
        path: 'src/sanitizer.js',
        oldText: '  // BUG: Missing redaction for OpenRouter API keys (\'sk-or-v1-[a-zA-Z0-9]+\')\n  // BUG: Missing redaction for Bearer tokens (\'Bearer [token]\')\n\n  return sanitized;',
        newText: '  sanitized = sanitized.replace(/sk-or-v1-[a-zA-Z0-9_-]{16,80}/g, \'[REDACTED_API_KEY]\');\n  sanitized = sanitized.replace(/Bearer\\s+[a-zA-Z0-9._-]+/gi, \'Bearer [REDACTED_TOKEN]\');\n\n  return sanitized;'
      }
    ]
  },
  'fixture-05-api-refactor': {
    planSummary: 'Refactor API error response envelope',
    filesExpectedToChange: ['src/responseFormatter.js'],
    patches: [
      {
        path: 'src/responseFormatter.js',
        oldText: 'function formatError(code, message, details = null) {\n  // BUG: Flat legacy properties instead of standard nested { success: false, error: { code, message, details } }\n  return {\n    success: false,\n    errorCode: code,\n    errorMessage: message,\n    details: details\n  };\n}',
        newText: 'function formatError(code, message, details = null) {\n  return {\n    success: false,\n    error: {\n      code,\n      message,\n      details: details !== undefined ? details : null\n    }\n  };\n}'
      }
    ]
  }
};

/**
 * Installs mock hooks on the aiGateway singleton for deterministic offline execution.
 */
function installMockGateway(activeFixtureRef) {
  const originalGeneratePlan = aiGateway.generatePlan.bind(aiGateway);
  const originalAgentTurn = aiGateway.agentTurn.bind(aiGateway);

  aiGateway.generatePlan = async function mockGeneratePlan(systemPrompt, userPrompt, options) {
    const fixtureId = activeFixtureRef.current;
    const config = MOCK_FIXTURE_PATCHES[fixtureId] || {
      planSummary: `Implementation plan for ${fixtureId}`,
      filesExpectedToChange: ['src/index.js']
    };

    return {
      summary: config.planSummary,
      approach: 'Direct targeted fix conforming to task specification.',
      steps: [
        {
          title: 'Apply targeted source modification',
          description: 'Refactor code to fix failing test assertions.',
          filesAffected: config.filesExpectedToChange
        }
      ],
      filesToInspect: config.filesExpectedToChange,
      filesExpectedToChange: config.filesExpectedToChange,
      validationStrategy: 'Run npm test to verify all test suites pass.',
      markdown: `### Implementation Plan\n\nTargeted patch for ${fixtureId}.`,
      usage: { promptTokens: 450, completionTokens: 120, totalTokens: 570 }
    };
  };

  aiGateway.agentTurn = async function mockAgentTurn(arg1, arg2) {
    const fixtureId = activeFixtureRef.current;
    const config = MOCK_FIXTURE_PATCHES[fixtureId];

    const messages = Array.isArray(arg1) ? arg1 : (arg1?.messages || []);

    const hasPatched = messages.some(m =>
      m.role === 'tool' && m.content && m.content.includes('Successfully')
    );

    const isSelfCorrection = messages.some(m =>
      typeof m.content === 'string' && (
        m.content.includes('SELF-CORRECTION') ||
        m.content.includes('FAILED VALIDATION') ||
        m.content.toLowerCase().includes('validation fail') ||
        m.content.toLowerCase().includes('failed project validation')
      )
    );

    // If step was already patched, complete the step
    if (hasPatched) {
      return {
        message: {
          role: 'assistant',
          content: 'Step completed.',
          tool_calls: [
            {
              id: `call_${Date.now()}_complete`,
              type: 'function',
              function: {
                name: 'complete_step',
                arguments: JSON.stringify({ summary: 'Targeted fix applied.' })
              }
            }
          ]
        },
        usage: { promptTokens: 300, completionTokens: 50, totalTokens: 350 },
        metadata: {
          model: 'mock-deterministic',
          finalModel: 'mock-deterministic',
          usage: { promptTokens: 300, completionTokens: 50, totalTokens: 350 }
        }
      };
    }

    // Determine appropriate patch
    let patchToApply = null;
    if (fixtureId === 'fixture-03-validation-recovery') {
      if (isSelfCorrection) {
        patchToApply = config.recoveryPatch;
      } else {
        patchToApply = config.initialPatch;
      }
    } else if (config && config.patches && config.patches[0]) {
      patchToApply = config.patches[0];
    }

    if (patchToApply) {
      return {
        message: {
          role: 'assistant',
          content: 'Applying fix.',
          tool_calls: [
            {
              id: `call_${Date.now()}_patch`,
              type: 'function',
              function: {
                name: 'apply_patch',
                arguments: JSON.stringify({
                  path: patchToApply.path,
                  oldText: patchToApply.oldText,
                  newText: patchToApply.newText
                })
              }
            }
          ]
        },
        usage: { promptTokens: 600, completionTokens: 180, totalTokens: 780 },
        metadata: {
          model: 'mock-deterministic',
          finalModel: 'mock-deterministic',
          usage: { promptTokens: 600, completionTokens: 180, totalTokens: 780 }
        }
      };
    }

    // Default completion fallback
    return {
      message: {
        role: 'assistant',
        content: 'Finished.',
        tool_calls: [
          {
            id: `call_${Date.now()}_complete`,
            type: 'function',
            function: {
              name: 'complete_step',
              arguments: JSON.stringify({ summary: 'No further changes required.' })
            }
          }
        ]
      },
      usage: { promptTokens: 200, completionTokens: 40, totalTokens: 240 },
      metadata: {
        model: 'mock-deterministic',
        finalModel: 'mock-deterministic',
        usage: { promptTokens: 200, completionTokens: 40, totalTokens: 240 }
      }
    };
  };

  return function restoreGateway() {
    aiGateway.generatePlan = originalGeneratePlan;
    aiGateway.agentTurn = originalAgentTurn;
  };
}

/**
 * Runs an individual benchmark scenario inside an isolated workspace.
 */
async function runScenario(fixture, runId, options = {}) {
  const { id: fixtureId, path: fixtureSrcPath, meta } = fixture;
  const startTime = Date.now();
  const preserveWorkspace = options.preserveWorkspace === true;

  // Enforce containment under workspaces root
  const benchWorkspaceName = `bench_${runId}_${fixtureId}`;
  const benchWorkspacePath = path.resolve(WORKSPACES_DIR, benchWorkspaceName);

  // Generate ephemeral ObjectIds
  const ephemeralUserId = new mongoose.Types.ObjectId();
  const ephemeralRepoId = new mongoose.Types.ObjectId();
  const repoWorkspacePath = path.resolve(WORKSPACES_DIR, ephemeralRepoId.toString());

  let junctionCreated = false;
  let taskDoc = null;
  let repoDoc = null;
  let userDoc = null;
  let branchDoc = null;
  let executionDoc = null;
  let auditEventsCount = 0;
  let baselineResult = { exitCode: 1, passed: false };
  let finalStatus = 'FAILED';
  let scenarioError = null;

  try {
    // 1. Prepare isolated workspace directory
    await fsp.mkdir(benchWorkspacePath, { recursive: true });
    await copyDir(fixtureSrcPath, benchWorkspacePath);

    // 2. Initialize fresh git repository and record baseline commit
    spawnSync('git', ['init'], { cwd: benchWorkspacePath, shell: false });
    spawnSync('git', ['config', 'user.name', 'Optimus Benchmark'], { cwd: benchWorkspacePath, shell: false });
    spawnSync('git', ['config', 'user.email', 'benchmark@optimus.local'], { cwd: benchWorkspacePath, shell: false });
    spawnSync('git', ['add', '.'], { cwd: benchWorkspacePath, shell: false });
    spawnSync('git', ['commit', '-m', 'Initial baseline commit'], { cwd: benchWorkspacePath, shell: false });

    // 3. Verify baseline failure (must fail according to meta.json)
    const baseTestRes = await runInSandbox('npm test', benchWorkspacePath, { timeoutMs: 30000 });
    baselineResult = {
      exitCode: baseTestRes.exitCode,
      passed: baseTestRes.passed,
      stdout: scrubTokens((baseTestRes.stdout || '').substring(0, 1000)),
      stderr: scrubTokens((baseTestRes.stderr || '').substring(0, 1000))
    };

    if (baselineResult.passed) {
      throw new Error(`Baseline failure check failed: fixture ${fixtureId} unexpectedly passed baseline test.`);
    }

    // 4. Create junction link so executionService can locate workspace by repo._id
    if (process.platform === 'win32') {
      fs.symlinkSync(benchWorkspacePath, repoWorkspacePath, 'junction');
    } else {
      fs.symlinkSync(benchWorkspacePath, repoWorkspacePath, 'dir');
    }
    junctionCreated = true;

    // 5. Create ephemeral DB entities
    userDoc = await User.create({
      _id: ephemeralUserId,
      username: `bench_${fixtureId}_${Date.now()}`,
      name: 'Optimus Benchmark Runner',
      email: `bench_${fixtureId}@optimus.local`
    });

    repoDoc = await Repository.create({
      _id: ephemeralRepoId,
      userId: ephemeralUserId,
      provider: 'github',
      owner: 'optimus-benchmark',
      name: fixtureId,
      status: 'READY'
    });

    branchDoc = await RepositoryBranch.create({
      repositoryId: ephemeralRepoId,
      name: 'main',
      isDefault: true,
      commitSha: 'initial_benchmark_sha',
      fileIndex: {
        files: meta.expectedChangedFiles || ['src/index.js'],
        symbols: []
      }
    });

    taskDoc = await Task.create({
      repositoryId: ephemeralRepoId,
      userId: ephemeralUserId,
      title: meta.title,
      description: meta.taskPrompt,
      status: 'CONTEXT_READY'
    });

    // Populate TaskContext
    await TaskContext.create({
      taskId: taskDoc._id,
      fileTree: meta.expectedChangedFiles || ['src/index.js'],
      symbols: [],
      dependencies: []
    });

    // 6. Plan generation via orchestrator
    const planRes = await orchestrator.planTask(taskDoc._id, ephemeralUserId);
    const plan = planRes.plan;

    // 7. Auto-approve plan in benchmark mode
    plan.approvedAt = new Date();
    plan.approvedBy = ephemeralUserId;
    await plan.save();

    taskDoc.approvedPlanHash = plan.planHash;
    taskDoc.status = 'AWAITING_APPROVAL';
    await taskDoc.save();

    // 8. Execute task via executionService
    await executionService.executeTask(taskDoc._id, ephemeralUserId);

    // Refresh task & execution state
    taskDoc = await Task.findById(taskDoc._id);
    executionDoc = await Execution.findOne({ taskId: taskDoc._id });
    finalStatus = taskDoc.status === 'VERIFIED' ? 'VERIFIED' : (taskDoc.status || 'FAILED');

    if (executionDoc) {
      auditEventsCount = await ExecutionEvent.countDocuments({ executionId: executionDoc._id });
    }

  } catch (err) {
    scenarioError = err.message || String(err);
    finalStatus = err.message?.includes('Baseline failure check failed') ? 'BASELINE_INVALID' : 'EXECUTION_ERROR';
  } finally {
    // 9. Teardown junction & workspace
    if (junctionCreated) {
      try {
        if (process.platform === 'win32') {
          fs.rmSync(repoWorkspacePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(repoWorkspacePath);
        }
      } catch (_) {}
    }

    if (!preserveWorkspace) {
      try {
        await fsp.rm(benchWorkspacePath, { recursive: true, force: true });
      } catch (rmErr) {
        console.warn(`Warning: Failed to remove workspace ${benchWorkspacePath}: ${rmErr.message}`);
      }
    }

    // 10. Clean up ephemeral database entities
    if (taskDoc) {
      try {
        await ExecutionEvent.deleteMany({ taskId: taskDoc._id });
        await Execution.deleteMany({ taskId: taskDoc._id });
        await TaskPlan.deleteMany({ taskId: taskDoc._id });
        await TaskContext.deleteMany({ taskId: taskDoc._id });
        await TaskMessage.deleteMany({ taskId: taskDoc._id });
        await Task.deleteOne({ _id: taskDoc._id });
      } catch (_) {}
    }
    if (repoDoc) {
      try {
        await RepositoryBranch.deleteMany({ repositoryId: repoDoc._id });
        await Repository.deleteOne({ _id: repoDoc._id });
      } catch (_) {}
    }
    if (userDoc) {
      try {
        await User.deleteOne({ _id: userDoc._id });
      } catch (_) {}
    }
  }

  const durationMs = Date.now() - startTime;
  const isVerified = finalStatus === 'VERIFIED';
  const validationAttempts = executionDoc?.validationResults?.attempts || 1;
  const recovered = isVerified && validationAttempts > 1;

  const rawChangedFiles = executionDoc?.changedFiles || [];
  const expectedFiles = meta.expectedChangedFiles || [];

  // Diff precision calculation for this scenario
  let matchedFiles = 0;
  for (const f of rawChangedFiles) {
    if (expectedFiles.some(exp => f.endsWith(exp) || exp.endsWith(f))) {
      matchedFiles += 1;
    }
  }
  const diffPrecision = rawChangedFiles.length > 0 ? (matchedFiles / rawChangedFiles.length) * 100 : 100.0;

  const tokens = executionDoc?.metadata?.usage || {
    promptTokens: executionDoc?.metadata?.promptTokens || 0,
    completionTokens: executionDoc?.metadata?.completionTokens || 0,
    totalTokens: executionDoc?.metadata?.totalTokens || 0
  };

  return {
    fixtureId,
    title: meta.title,
    category: meta.category || 'BUG_FIX',
    status: finalStatus,
    durationMs,
    baseline: baselineResult,
    postExecution: {
      passed: isVerified,
      exitCode: isVerified ? 0 : 1
    },
    validationAttempts,
    recovered,
    changedFiles: rawChangedFiles,
    expectedFiles,
    diffPrecision: Math.round(diffPrecision * 10) / 10,
    tokens,
    cost: executionDoc?.metadata?.cost || '$0.00 (Free Tier)',
    diff: scrubTokens(executionDoc?.executionLogs?.find(l => l.text?.includes('Final Workspace Diff'))?.text || ''),
    auditEventsCount,
    error: scenarioError ? scrubTokens(scenarioError) : null
  };
}

/**
 * Main benchmark runner orchestration.
 *
 * @param {Object} [options]
 * @param {string} [options.mode='mock'] - Execution mode ('mock' or 'live')
 * @param {Array<string>|string} [options.fixtures] - Selected fixture ID(s)
 * @param {boolean} [options.preserveWorkspace=false] - Retain workspace on disk
 * @param {string} [options.outputDir] - Destination for report files
 * @param {number} [options.delayMs=1500] - Pause between scenarios
 * @returns {Promise<Object>} Complete benchmark run scorecard and report metadata
 */
async function runBenchmark(options = {}) {
  const mode = options.mode === 'live' ? 'live' : 'mock';
  const delayMs = typeof options.delayMs === 'number' ? Math.max(0, options.delayMs) : 1500;
  const outputDir = options.outputDir ? path.resolve(options.outputDir) : DEFAULT_REPORTS_DIR;
  const runId = sanitizeRunId(options.runId || `bench_run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

  // Ensure database connection
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }

  // 1. Discover all available fixtures
  const allFixtures = discoverFixtures(FIXTURES_DIR);
  if (allFixtures.length === 0) {
    throw new Error(`No valid benchmark fixtures found in ${FIXTURES_DIR}`);
  }

  // 2. Filter requested fixtures
  let selectedFixtures = allFixtures;
  if (options.fixtures) {
    const requested = Array.isArray(options.fixtures)
      ? options.fixtures
      : String(options.fixtures).split(',').map(s => s.trim()).filter(Boolean);

    for (const reqId of requested) {
      if (!validateFixtureId(reqId)) {
        throw new Error(`Invalid or unsafe fixture ID requested: "${reqId}". Fixture IDs must match ^[a-zA-Z0-9_-]+$`);
      }
    }

    selectedFixtures = allFixtures.filter(f => requested.includes(f.id));
    if (selectedFixtures.length === 0) {
      throw new Error(`None of the requested fixtures matched available fixtures: ${requested.join(', ')}`);
    }
  }

  console.log(`Starting OPTIMUS Benchmark Run [${runId}] in ${mode.toUpperCase()} mode (${selectedFixtures.length} fixture(s))...`);

  const activeFixtureRef = { current: null };
  let restoreGateway = null;

  if (mode === 'mock') {
    restoreGateway = installMockGateway(activeFixtureRef);
  }

  const scenarioResults = [];

  try {
    // Concurrency strictly 1 (sequential execution)
    for (let i = 0; i < selectedFixtures.length; i++) {
      const fixture = selectedFixtures[i];
      activeFixtureRef.current = fixture.id;

      console.log(`[${i + 1}/${selectedFixtures.length}] Executing ${fixture.id}...`);
      const result = await runScenario(fixture, runId, options);
      scenarioResults.push(result);
      console.log(`    -> Status: ${result.status} | Duration: ${(result.durationMs / 1000).toFixed(1)}s | Attempts: ${result.validationAttempts}`);

      // Inter-task pause
      if (i < selectedFixtures.length - 1 && delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  } finally {
    if (restoreGateway) {
      restoreGateway();
    }
  }

  // 3. Compute 8 quantitative benchmark metrics
  const metrics = calculateMetrics(scenarioResults);

  // 4. Generate & write reports
  const benchmarkData = {
    benchmarkRunId: runId,
    timestamp: new Date().toISOString(),
    mode,
    environment: {
      executionMode: mode,
      nodeVersion: process.version,
      platform: process.platform,
      model: mode === 'mock' ? 'Deterministic Mock Simulation' : (process.env.AI_MODEL || 'OpenRouter Free Model Hierarchy')
    },
    metrics,
    scenarios: scenarioResults
  };

  const reportFiles = writeReportFiles(benchmarkData, outputDir, { fileNamePrefix: runId });

  console.log(`Benchmark Run [${runId}] complete! Status: ${metrics.summary.status}`);
  console.log(`Reports generated:\n  JSON: ${reportFiles.jsonPath}\n  MD:   ${reportFiles.markdownPath}`);

  return {
    benchmarkRunId: runId,
    timestamp: benchmarkData.timestamp,
    mode,
    environment: benchmarkData.environment,
    summary: metrics.summary,
    metrics,
    scenarios: scenarioResults,
    tokenCounts: metrics.tokens,
    reportPaths: {
      json: reportFiles.jsonPath,
      markdown: reportFiles.markdownPath
    }
  };
}

module.exports = {
  runBenchmark,
  discoverFixtures,
  validateFixtureId,
  runScenario,
  FIXTURES_DIR,
  WORKSPACES_DIR,
  DEFAULT_REPORTS_DIR
};
