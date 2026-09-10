const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const Task = require('../models/Task');
const TaskPlan = require('../models/TaskPlan');
const Execution = require('../models/Execution');
const Repository = require('../models/Repository');
const aiGateway = require('../ai/gateway');
const { executeTool, scrubTokens, sanitizeToolArguments, getToolMutability } = require('../agent/toolExecutors');
const { buildStepMessages, buildCorrectionMessages, pruneMessageHistory } = require('../agent/contextEngine');
const { FailureTypes, classifyFailure, formatFailureDiagnostics } = require('../agent/failureTypes');
const { generateTraceId, recordEvent, resetSequenceCounter } = require('./auditService');
const { acquireExecutionLock, releaseExecutionLock, heartbeatLock, isTaskExecuting } = require('./executionLock');

const activeExecutions = new Map();

// Execution Budget & Safeguard Boundaries
const MAX_TURNS_PER_STEP = 15;
const MAX_TOTAL_TOOL_CALLS = 35;
const MAX_EXECUTION_TIME_MS = 300000; // 5 minutes max wall-clock time
const MAX_REPEATED_TOOL_CALLS = 3;    // Prevent infinite loop on identical tool calls
const MAX_VALIDATION_ATTEMPTS = 3;    // Maximum self-correction attempts
const MAX_CORRECTION_TURNS = 10;      // Maximum turns per correction attempt

const EventEmitter = require('events');
const executionEmitter = new EventEmitter();
executionEmitter.setMaxListeners(200);

function mapToolToAction(funcName) {
  switch (funcName) {
    case 'read_file': return 'readFile';
    case 'create_file': return 'writeFile';
    case 'apply_patch': return 'editFile';
    case 'run_validation': return 'runCommand';
    default: return funcName;
  }
}

function emitExecutionEvent(taskId, eventPayload) {
  if (!taskId || !eventPayload) return;
  try {
    const raw = typeof eventPayload.toObject === 'function' ? eventPayload.toObject() : { ...eventPayload };
    const safePayload = {
      ...raw,
      taskId: taskId.toString(),
      type: raw.eventType || raw.type || 'event',
      eventType: raw.eventType || raw.type || 'event',
      timestamp: raw.timestamp || new Date()
    };
    if (typeof safePayload.summary === 'string') {
      safePayload.summary = scrubTokens(safePayload.summary);
    }
    if (typeof safePayload.text === 'string') {
      safePayload.text = scrubTokens(safePayload.text);
    }
    if (typeof safePayload.output === 'string') {
      safePayload.output = scrubTokens(safePayload.output);
    }
    executionEmitter.emit('task:' + taskId.toString(), safePayload);
    executionEmitter.emit('event', safePayload);
  } catch (err) {
    console.error('Error emitting execution event:', err);
  }
}

async function recordAndEmit(eventData) {
  try {
    const event = await recordEvent(eventData);
    emitExecutionEvent(eventData.taskId, event || eventData);
    return event;
  } catch (err) {
    emitExecutionEvent(eventData.taskId, eventData);
  }
}

async function logSystem(executionId, text, stream = 'system', taskId = null) {
  const safeText = scrubTokens(typeof text === 'string' ? text : (text?.output || String(text)));
  try {
    await Execution.findByIdAndUpdate(executionId, {
      $push: { executionLogs: { timestamp: new Date(), stream, text: safeText.substring(0, 4000) } }
    });
  } catch (_) {}
}

/**
 * Main execution orchestration.
 */
async function executeTask(taskId, userId) {
  if (activeExecutions.has(taskId.toString())) {
    throw new Error(`Task ${taskId} is already executing.`);
  }

  const executionStartTime = Date.now();
  let totalTurns = 0;
  let totalToolCalls = 0;
  let lastToolKey = null;
  let repeatedToolCount = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTokens = 0;
  let lastUsedModel = null;
  let anyFallbackUsed = false;
  const modelsAttemptedSet = new Set();

  const task = await Task.findOne({ _id: taskId, userId });
  if (!task) throw new Error('Task not found');
  const eligibleStatuses = ['AWAITING_APPROVAL', 'FAILED', 'CANCELLED'];
  if (!eligibleStatuses.includes(task.status)) {
    throw new Error(`Task is not eligible for execution (Status: ${task.status})`);
  }

  const plan = await TaskPlan.findOne({ taskId: task._id });
  if (!plan) throw new Error('Task plan not found');
  if (!task.approvedPlanHash || task.approvedPlanHash !== plan.planHash) {
    throw new Error('Plan integrity check failed: approved plan hash does not match current plan.');
  }

  const repo = await Repository.findOne({ _id: task.repositoryId, userId });
  if (!repo) throw new Error('Repository not found or access denied');

  const workspacePath = path.resolve(__dirname, '../../workspaces', repo._id.toString());
  try {
    await fs.access(workspacePath);
  } catch (err) {
    throw new Error('Repository workspace is missing on disk.');
  }

  let execution = await Execution.findOne({ taskId: task._id });
  const traceId = generateTraceId();

  if (!execution) {
    execution = new Execution({
      taskId: task._id,
      repositoryId: repo._id,
      userId: userId,
      status: 'RUNNING',
      totalSteps: plan.steps.length,
      startedAt: new Date(),
      executionLogs: [],
      traceId
    });
    await execution.save();
  } else {
    execution.status = 'RUNNING';
    execution.currentStep = 0;
    execution.error = '';
    execution.executionLogs = [];
    execution.startedAt = new Date();
    execution.completedAt = null;
    execution.traceId = traceId;
    execution.failureDetails = null;
    if (execution.metadata) {
      execution.metadata.failureCategory = null;
      execution.metadata.durationMs = null;
    }
    execution.validationResults = null;
    await execution.save();
  }

  const log = async (text, stream = 'system') => logSystem(execution._id, text, stream, task._id);

  resetSequenceCounter(execution._id);

  task.status = 'IMPLEMENTING';
  await task.save();

  const abortController = new AbortController();
  activeExecutions.set(taskId.toString(), abortController);

  try {
  // Acquire concurrency and workspace lock
  try {
    acquireExecutionLock(taskId, repo._id, userId, abortController);
  } catch (lockErr) {
    throw lockErr;
  }

  // Record EXECUTION_STARTED audit event
  try {
    await recordAndEmit({
      executionId: execution._id,
      taskId: task._id,
      userId,
      traceId,
      eventType: 'EXECUTION_STARTED',
      status: 'IN_PROGRESS',
      summary: `Execution started for task: ${task.title}`,
      metadata: { totalSteps: plan.steps.length, planHash: plan.planHash }
    });
  } catch (_) {}

  try {
    const changedFiles = new Set();

    // 1. Create a Git branch for isolated execution (Rollback capability)
    try {
      const branchName = `optimus-execution-${execution._id}`;
      await new Promise((resolve, reject) => {
        const proc = spawn('git', ['checkout', '-B', branchName], { cwd: workspacePath, shell: false });
        proc.on('close', (code) => code === 0 ? resolve() : reject(new Error('Git branch failed')));
      });
      await log(`Created isolated git branch: ${branchName}`);
    } catch(err) {
      await log(`Warning: Could not create git branch. Executing in current branch.`);
    }

    // 2. Iterate Plan Steps with Bounded Agent Loop
    for (let i = 0; i < plan.steps.length; i++) {
      if (abortController.signal.aborted) throw new Error('Execution cancelled');
      if (Date.now() - executionStartTime > MAX_EXECUTION_TIME_MS) {
        throw new Error('Execution budget exceeded wall-clock limit of 5 minutes');
      }

      const step = plan.steps[i];
      execution.currentStep = i + 1;
      await execution.save();
      heartbeatLock(taskId);

      await log(`Starting Step ${i + 1}: ${step.title}`);

      // Record STEP_STARTED audit event
      try {
        await recordAndEmit({
          executionId: execution._id,
          taskId: task._id,
          userId,
          traceId,
          eventType: 'STEP_STARTED',
          stepIndex: i + 1,
          status: 'IN_PROGRESS',
          summary: `Starting Step ${i + 1}: ${step.title}`,
          metadata: { stepTitle: step.title, filesAffected: step.filesAffected }
        });
      } catch (_) {}

      // Extract current git diff snippet for bounded context
      const currentDiffRes = await executeTool('git_diff', {}, workspacePath);
      const currentDiff = (typeof currentDiffRes === 'string' && !currentDiffRes.startsWith('Error:')) ? currentDiffRes : '';

      // Initialize Agent Messages via Bounded Context Engine
      let messages = buildStepMessages({
        task,
        plan,
        stepIndex: i,
        currentDiff,
        changedFiles: Array.from(changedFiles)
      });

      let stepComplete = false;
      let turnCount = 0;

      while (!stepComplete && turnCount < MAX_TURNS_PER_STEP) {
        if (abortController.signal.aborted) throw new Error('Execution cancelled');
        if (Date.now() - executionStartTime > MAX_EXECUTION_TIME_MS) {
          throw new Error('Execution budget exceeded wall-clock limit of 5 minutes');
        }

        turnCount++;
        totalTurns++;
        heartbeatLock(taskId);

        // Prune and bound message history to prevent context overflow
        messages = pruneMessageHistory(messages);

        // Record AI_TURN_STARTED audit event
        try {
          await recordAndEmit({
            executionId: execution._id,
            taskId: task._id,
            userId,
            traceId,
            eventType: 'AI_TURN_STARTED',
            stepIndex: i + 1,
            turnNumber: turnCount,
            status: 'IN_PROGRESS',
            summary: `AI turn ${turnCount} initiated for step ${i + 1}`
          });
        } catch (_) {}

        // Call Agent via AI Gateway
        const turnStartTime = Date.now();
        const aiResponse = await aiGateway.agentTurn(messages);
        const turnDuration = Date.now() - turnStartTime;
        const responseMessage = aiResponse.message;

        if (aiResponse.metadata) {
          lastUsedModel = aiResponse.metadata.finalModel || aiResponse.metadata.model || lastUsedModel;
          if (aiResponse.metadata.fallbackUsed || aiResponse.metadata.modelFallbackUsed) {
            anyFallbackUsed = true;
          }
          if (Array.isArray(aiResponse.metadata.modelsAttempted)) {
            aiResponse.metadata.modelsAttempted.forEach(m => modelsAttemptedSet.add(m));
          }
          if (aiResponse.metadata.usage) {
            totalPromptTokens += (aiResponse.metadata.usage.promptTokens || 0);
            totalCompletionTokens += (aiResponse.metadata.usage.completionTokens || 0);
            totalTokens += (aiResponse.metadata.usage.totalTokens || 0);
          }
        }

        // Record AI_TURN_COMPLETED audit event
        try {
          await recordAndEmit({
            executionId: execution._id,
            taskId: task._id,
            userId,
            traceId,
            eventType: 'AI_TURN_COMPLETED',
            stepIndex: i + 1,
            turnNumber: turnCount,
            durationMs: turnDuration,
            status: 'SUCCESS',
            summary: `AI turn ${turnCount} completed in ${turnDuration}ms`,
            metadata: {
              model: aiResponse.metadata?.model,
              provider: aiResponse.metadata?.provider,
              usage: aiResponse.metadata?.usage,
              toolCallsCount: (responseMessage.tool_calls || []).length
            }
          });
        } catch (_) {}

        // Add Assistant message to history
        messages.push(responseMessage);

        if (responseMessage.content) {
          await log(`AI: ${responseMessage.content}`, 'stdout');
        }

        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
          for (const toolCall of responseMessage.tool_calls) {
            totalToolCalls++;
            if (totalToolCalls > MAX_TOTAL_TOOL_CALLS) {
              throw new Error(`Execution tool call limit exceeded (maximum ${MAX_TOTAL_TOOL_CALLS} tool calls)`);
            }

            const funcName = toolCall.function.name;
            const argsStr = toolCall.function.arguments;
            const args = JSON.parse(argsStr);
            const mutability = getToolMutability(funcName);

            // Repeated identical tool call loop detection
            const currentToolKey = `${funcName}:${argsStr}`;
            if (currentToolKey === lastToolKey) {
              repeatedToolCount++;
              if (repeatedToolCount >= MAX_REPEATED_TOOL_CALLS) {
                throw new Error(`Repeated identical tool call loop detected for "${funcName}". Execution stopped to prevent loop.`);
              }
            } else {
              lastToolKey = currentToolKey;
              repeatedToolCount = 1;
            }

            await log(`Executing Tool: ${funcName}(${JSON.stringify(args)})`, 'system');

            if (funcName === 'complete_step') {
              stepComplete = true;
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: 'Step marked complete.'
              });
              break;
            }

            // Record TOOL_CALL_STARTED audit event
            try {
              await recordAndEmit({
                executionId: execution._id,
                taskId: task._id,
                userId,
                traceId,
                eventType: 'TOOL_CALL_STARTED',
                stepIndex: i + 1,
                turnNumber: turnCount,
                toolName: funcName,
                status: 'IN_PROGRESS',
                summary: `Tool call started: ${funcName}`,
                metadata: {
                  mutability,
                  args: sanitizeToolArguments(args)
                }
              });
            } catch (_) {}

            // Execute actual tool securely via sandbox/toolExecutors
            const toolStartTime = Date.now();
            const resultStr = await executeTool(funcName, args, workspacePath);
            const toolDuration = Date.now() - toolStartTime;

            const isSuccess = !String(resultStr).startsWith('Error:');

            // Record TOOL_CALL_COMPLETED audit event
            try {
              await recordAndEmit({
                executionId: execution._id,
                taskId: task._id,
                userId,
                traceId,
                eventType: 'TOOL_CALL_COMPLETED',
                stepIndex: i + 1,
                turnNumber: turnCount,
                toolName: funcName,
                durationMs: toolDuration,
                status: isSuccess ? 'SUCCESS' : 'FAILED',
                summary: `Tool ${funcName} ${isSuccess ? 'completed successfully' : 'failed'} (${toolDuration}ms)`,
                metadata: {
                  mutability,
                  success: isSuccess,
                  outputSummary: scrubTokens(String(resultStr).substring(0, 200))
                }
              });
            } catch (_) {}

            // Track files changed
            if (funcName === 'apply_patch' || funcName === 'create_file') {
              const resultText = typeof resultStr === 'string' ? resultStr : (resultStr?.output || String(resultStr));
              if (resultText.startsWith('Successfully')) {
                changedFiles.add(args.path);
              }
            }

            // Add Tool Result to history
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: typeof resultStr === 'string' ? resultStr : (resultStr?.output || String(resultStr))
            });
          }
        } else {
          // If the AI didn't call a tool and didn't complete the step, nudge it.
          messages.push({
            role: 'user',
            content: 'Please use a tool or call complete_step to finish this step.'
          });
        }
      }

      if (!stepComplete) {
        throw new Error(`Step ${i + 1} timed out after ${MAX_TURNS_PER_STEP} agent turns.`);
      }
    }

    // 3. Validation Phase with Bounded Self-Correction
    execution.status = 'VALIDATING';
    execution.changedFiles = Array.from(changedFiles);
    await execution.save();
    task.status = 'TESTING';
    await task.save();
    heartbeatLock(taskId);

    await log(`Starting validation phase...`);

    // Check if package.json exists to determine validation scripts
    const pkgPath = path.join(workspacePath, 'package.json');
    let pkg = null;
    try {
      pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
    } catch (e) {
      // package.json does not exist or invalid JSON
    }

    const validationRuns = [];
    let validationSuccess = true;
    let validationAttempts = 0;
    let previousFailureSignature = null;

    if (pkg && pkg.scripts) {
      // Determine validation scripts to run in deterministic order: test -> build -> lint
      const validationCommands = [];
      if (pkg.scripts.test) validationCommands.push('npm test');
      if (pkg.scripts.build) validationCommands.push('npm run build');
      if (pkg.scripts.lint) validationCommands.push('npm run lint');

      if (validationCommands.length > 0) {
        // Run npm install if node_modules is missing and dependencies exist
        const nodeModulesPath = path.join(workspacePath, 'node_modules');
        let nodeModulesExist = false;
        try {
          await fs.access(nodeModulesPath);
          nodeModulesExist = true;
        } catch (_) {}

        if (!nodeModulesExist && (pkg.dependencies || pkg.devDependencies)) {
          await log(`Running validation preparation (npm install)...`);
          const installRes = await executeTool('run_validation', { command: 'npm install', timeoutMs: 60000 }, workspacePath);
          await log(installRes.output || String(installRes), 'stdout');
          if (installRes.exitCode !== 0) {
            await log(`Warning: npm install exited with code ${installRes.exitCode}`, 'stderr');
          }
        }

        validationSuccess = false;

        while (!validationSuccess && validationAttempts < MAX_VALIDATION_ATTEMPTS) {
          if (abortController.signal.aborted) throw new Error('Execution cancelled');
          if (Date.now() - executionStartTime > MAX_EXECUTION_TIME_MS) {
            throw new Error('Execution budget exceeded wall-clock limit of 5 minutes');
          }

          validationAttempts++;
          heartbeatLock(taskId);

          // Transition task status: initial attempt is TESTING, retry attempts are VERIFYING
          task.status = validationAttempts === 1 ? 'TESTING' : 'VERIFYING';
          await task.save();

          await log(`Validation Attempt ${validationAttempts} of ${MAX_VALIDATION_ATTEMPTS}...`);

          let currentAttemptPassed = true;
          let failureDetails = null;

          for (const cmd of validationCommands) {
            if (abortController.signal.aborted) throw new Error('Execution cancelled');

            await log(`Running validation command: ${cmd} (Attempt ${validationAttempts})...`);

            // Record VALIDATION_STARTED audit event
            try {
              await recordAndEmit({
                executionId: execution._id,
                taskId: task._id,
                userId,
                traceId,
                eventType: 'VALIDATION_STARTED',
                status: 'IN_PROGRESS',
                summary: `Running validation command: ${cmd} (Attempt ${validationAttempts})`,
                metadata: { attempt: validationAttempts, command: cmd }
              });
            } catch (_) {}

            const runRes = await executeTool('run_validation', { command: cmd, timeoutMs: 60000 }, workspacePath);
            const outputText = runRes.output || String(runRes);
            await log(outputText, runRes.exitCode === 0 ? 'stdout' : 'stderr');

            const isPassed = runRes.passed === true && runRes.exitCode === 0;

            // Record VALIDATION_COMPLETED audit event
            try {
              await recordAndEmit({
                executionId: execution._id,
                taskId: task._id,
                userId,
                traceId,
                eventType: 'VALIDATION_COMPLETED',
                durationMs: runRes.durationMs || 0,
                status: isPassed ? 'SUCCESS' : 'FAILED',
                summary: `Validation ${cmd} ${isPassed ? 'passed' : 'failed'} with exit code ${runRes.exitCode}`,
                metadata: { attempt: validationAttempts, exitCode: runRes.exitCode, command: cmd, passed: isPassed }
              });
            } catch (_) {}

            const runRecord = {
              attempt: validationAttempts,
              command: cmd,
              exitCode: runRes.exitCode,
              passed: isPassed,
              durationMs: runRes.durationMs || 0,
              timedOut: !!runRes.timedOut,
              timestamp: new Date()
            };
            validationRuns.push(runRecord);

            if (!runRecord.passed) {
              currentAttemptPassed = false;
              failureDetails = {
                command: cmd,
                exitCode: runRes.exitCode,
                output: runRes.stderr || runRes.stdout || outputText
              };
              break;
            }
          }

          if (currentAttemptPassed) {
            validationSuccess = true;
            await log(`Validation successful on attempt ${validationAttempts}! All checks passed.`);
            break;
          }

          if (validationAttempts >= MAX_VALIDATION_ATTEMPTS) {
            await log(`Validation failed after maximum ${MAX_VALIDATION_ATTEMPTS} retry attempts.`, 'stderr');
            break;
          }

          // Check for repeated identical validation failure with zero code modifications
          const currentSignature = `${failureDetails.command}:${failureDetails.exitCode}:${(failureDetails.output || '').slice(0, 100)}`;
          const filesBeforeCorrection = changedFiles.size;

          // Agent self-correction loop
          task.status = 'DIAGNOSING';
          await task.save();
          await log(`Validation failed on attempt ${validationAttempts}. Diagnosing failure: ${failureDetails?.command} exited with code ${failureDetails?.exitCode}`);

          task.status = 'RETRYING';
          await task.save();
          await log(`Initiating agent self-correction turn (Attempt ${validationAttempts + 1}/${MAX_VALIDATION_ATTEMPTS})...`);

          // Record SELF_CORRECTION_STARTED audit event
          try {
            await recordAndEmit({
              executionId: execution._id,
              taskId: task._id,
              userId,
              traceId,
              eventType: 'SELF_CORRECTION_STARTED',
              status: 'IN_PROGRESS',
              summary: `Initiating self-correction (Attempt ${validationAttempts + 1})`,
              metadata: { failedCommand: failureDetails?.command, exitCode: failureDetails?.exitCode }
            });
          } catch (_) {}

          const valDiffRes = await executeTool('git_diff', {}, workspacePath);
          const valDiff = (typeof valDiffRes === 'string' && !valDiffRes.startsWith('Error:')) ? valDiffRes : '';

          let valMessages = buildCorrectionMessages({
            failureDetails,
            validationAttempts: validationAttempts + 1,
            maxAttempts: MAX_VALIDATION_ATTEMPTS,
            currentDiff: valDiff,
            changedFiles: Array.from(changedFiles)
          });

          let valStepComplete = false;
          let valTurnCount = 0;

          while (!valStepComplete && valTurnCount < MAX_CORRECTION_TURNS) {
            if (abortController.signal.aborted) throw new Error('Execution cancelled');
            if (Date.now() - executionStartTime > MAX_EXECUTION_TIME_MS) {
              throw new Error('Execution budget exceeded wall-clock limit of 5 minutes');
            }

            valTurnCount++;
            totalTurns++;
            heartbeatLock(taskId);

            valMessages = pruneMessageHistory(valMessages);

            const aiResponse = await aiGateway.agentTurn(valMessages);
            const responseMessage = aiResponse.message;

            if (aiResponse.metadata) {
              lastUsedModel = aiResponse.metadata.finalModel || aiResponse.metadata.model || lastUsedModel;
              if (aiResponse.metadata.fallbackUsed || aiResponse.metadata.modelFallbackUsed) {
                anyFallbackUsed = true;
              }
              if (Array.isArray(aiResponse.metadata.modelsAttempted)) {
                aiResponse.metadata.modelsAttempted.forEach(m => modelsAttemptedSet.add(m));
              }
              if (aiResponse.metadata.usage) {
                totalPromptTokens += (aiResponse.metadata.usage.promptTokens || 0);
                totalCompletionTokens += (aiResponse.metadata.usage.completionTokens || 0);
                totalTokens += (aiResponse.metadata.usage.totalTokens || 0);
              }
            }

            valMessages.push(responseMessage);

            if (responseMessage.content) {
              await log(`AI: ${responseMessage.content}`, 'stdout');
            }

            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
              for (const toolCall of responseMessage.tool_calls) {
                totalToolCalls++;
                if (totalToolCalls > MAX_TOTAL_TOOL_CALLS) {
                  throw new Error(`Execution tool call limit exceeded (maximum ${MAX_TOTAL_TOOL_CALLS} tool calls)`);
                }

                const funcName = toolCall.function.name;
                const argsStr = toolCall.function.arguments;
                const args = JSON.parse(argsStr);
                const mutability = getToolMutability(funcName);

                // Repeated tool loop detection during self-correction
                const currentToolKey = `${funcName}:${argsStr}`;
                if (currentToolKey === lastToolKey) {
                  repeatedToolCount++;
                  if (repeatedToolCount >= MAX_REPEATED_TOOL_CALLS) {
                    throw new Error(`Repeated identical tool call loop detected for "${funcName}". Execution stopped to prevent loop.`);
                  }
                } else {
                  lastToolKey = currentToolKey;
                  repeatedToolCount = 1;
                }

                await log(`Executing Tool: ${funcName}(${JSON.stringify(args)})`, 'system');

                if (funcName === 'complete_step') {
                  valStepComplete = true;
                  valMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: 'Step marked complete.' });
                  break;
                }

                const toolStartTime = Date.now();
                const resultStr = await executeTool(funcName, args, workspacePath);
                const toolDuration = Date.now() - toolStartTime;

                if (funcName === 'apply_patch' || funcName === 'create_file') {
                  const resultText = typeof resultStr === 'string' ? resultStr : resultStr.output;
                  if (resultText && resultText.startsWith('Successfully')) changedFiles.add(args.path);
                }

                valMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: typeof resultStr === 'string' ? resultStr : (resultStr.output || String(resultStr))
                });
              }
            } else {
              valMessages.push({ role: 'user', content: 'Please use a tool to inspect/patch files or call complete_step.' });
            }
          }

          // Check if no progress was made on an identical failure
          if (currentSignature === previousFailureSignature && changedFiles.size === filesBeforeCorrection) {
            await log(`Repeated validation failure with no progress detected. Halting self-correction.`, 'stderr');
            break;
          }
          previousFailureSignature = currentSignature;
        }
      } else {
        await log(`No test, build, or lint scripts configured in package.json. Validation passed by default.`);
      }
    } else {
      await log(`No package.json found. Validation passed by default.`);
    }

    // Persist structured validation results
    execution.validationResults = {
      status: validationSuccess ? 'PASSED' : 'FAILED',
      attempts: validationAttempts,
      runs: validationRuns,
      completedAt: new Date()
    };
    await execution.save();

    if (!validationSuccess) {
      throw new Error(`Validation failed after ${validationAttempts} attempt(s).`);
    }

    // Final Git Diff
    const diff = await executeTool('git_diff', {}, workspacePath);
    await log(`Final Workspace Diff:\n${diff}`, 'stdout');

    execution.status = 'COMPLETED';
    execution.completedAt = new Date();
    execution.metadata = {
      durationMs: Date.now() - executionStartTime,
      totalTurns,
      totalToolCalls,
      validationAttempts,
      completedAt: new Date(),
      traceId,
      model: lastUsedModel,
      finalModel: lastUsedModel,
      fallbackUsed: anyFallbackUsed,
      modelsAttempted: Array.from(modelsAttemptedSet),
      cost: 'Cost unavailable / free model',
      usage: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalTokens
      },
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalTokens: totalTokens
    };
    await execution.save();

    task.status = 'VERIFIED';
    await task.save();

    // Record EXECUTION_COMPLETED audit event
    try {
      await recordAndEmit({
        executionId: execution._id,
        taskId: task._id,
        userId,
        traceId,
        eventType: 'EXECUTION_COMPLETED',
        status: 'SUCCESS',
        durationMs: Date.now() - executionStartTime,
        summary: `Execution completed successfully in ${Date.now() - executionStartTime}ms`,
        metadata: { totalTurns, totalToolCalls, validationAttempts, totalTokens }
      });
    } catch (_) {}

  } catch (error) {
    const failureCategory = classifyFailure(error);
    const isCancelled = error.message === 'Execution cancelled';
    execution.status = isCancelled ? 'CANCELLED' : 'FAILED';
    execution.error = error.message;
    execution.completedAt = new Date();

    const failureDiagnostics = formatFailureDiagnostics(error, { traceId });
    execution.failureDetails = failureDiagnostics;

    execution.metadata = {
      durationMs: Date.now() - executionStartTime,
      totalTurns,
      totalToolCalls,
      failureCategory,
      completedAt: new Date(),
      traceId,
      model: lastUsedModel,
      finalModel: lastUsedModel,
      fallbackUsed: anyFallbackUsed,
      modelsAttempted: Array.from(modelsAttemptedSet),
      cost: 'Cost unavailable / free model',
      usage: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalTokens
      },
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalTokens: totalTokens
    };

    if (!execution.validationResults && execution.status === 'FAILED') {
      execution.validationResults = {
        status: 'FAILED',
        error: error.message,
        failureCategory,
        completedAt: new Date()
      };
    }
    await execution.save();

    task.status = execution.status;
    await task.save();

    await log(`Execution Terminated [${failureCategory}]: ${error.message}`, 'stderr');

    // Rollback changes using git: reset tracked files and clean untracked files
    try {
      await log(`Attempting rollback via git...`);

      // Record ROLLBACK_STARTED audit event
      try {
        await recordAndEmit({
          executionId: execution._id,
          taskId: task._id,
          userId,
          traceId,
          eventType: 'ROLLBACK_STARTED',
          status: 'IN_PROGRESS',
          summary: 'Initiating git rollback to HEAD',
          metadata: { failureCategory }
        });
      } catch (_) {}

      await new Promise((resolve, reject) => {
        const proc = spawn('git', ['reset', '--hard', 'HEAD'], { cwd: workspacePath, shell: false });
        proc.on('close', code => code === 0 ? resolve() : reject(new Error('git reset failed')));
      });
      await new Promise((resolve, reject) => {
        const proc = spawn('git', ['clean', '-fd'], { cwd: workspacePath, shell: false });
        proc.on('close', code => code === 0 ? resolve() : reject(new Error('git clean failed')));
      });
      await log(`Rollback successful: git reset --hard HEAD and git clean -fd completed.`);

      // Record ROLLBACK_COMPLETED audit event
      try {
        await recordAndEmit({
          executionId: execution._id,
          taskId: task._id,
          userId,
          traceId,
          eventType: 'ROLLBACK_COMPLETED',
          status: 'SUCCESS',
          summary: 'Rollback completed successfully.'
        });
      } catch (_) {}

    } catch (e) {
      // Record ROLLBACK_FAILED audit event
      try {
        await recordAndEmit({
          executionId: execution._id,
          taskId: task._id,
          userId,
          traceId,
          eventType: 'ROLLBACK_FAILED',
          status: 'FAILED',
          summary: `Rollback encountered error: ${e.message}`
        });
      } catch (_) {}
    }

    // Record EXECUTION_FAILED or EXECUTION_CANCELLED audit event
    try {
      await recordAndEmit({
        executionId: execution._id,
        taskId: task._id,
        userId,
        traceId,
        eventType: isCancelled ? 'EXECUTION_CANCELLED' : 'EXECUTION_FAILED',
        status: isCancelled ? 'CANCELLED' : 'FAILED',
        failureCategory,
        durationMs: Date.now() - executionStartTime,
        summary: `Execution ${isCancelled ? 'cancelled' : 'failed'}: ${error.message}`,
        metadata: { failureDiagnostics }
      });
    } catch (_) {}

  } finally {
    releaseExecutionLock(taskId, repo ? repo._id : null);
    resetSequenceCounter(execution._id);
  }
  } finally {
    activeExecutions.delete(taskId.toString());
  }
}

async function cancelExecution(taskId, userId) {
  const task = await Task.findOne({ _id: taskId, userId });
  if (!task) throw new Error('Task not found');

  const abortController = activeExecutions.get(taskId.toString());
  if (abortController) {
    abortController.abort();
    return true;
  }
  return false;
}

function abortAllActiveExecutions() {
  for (const [taskId, abortController] of activeExecutions.entries()) {
    try {
      abortController.abort();
    } catch (_) {}
  }
  activeExecutions.clear();
}

module.exports = {
  executeTask,
  cancelExecution,
  abortAllActiveExecutions,
  activeExecutions,
  executionEmitter,
  emitExecutionEvent
};
