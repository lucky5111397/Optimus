const Task = require('../models/Task');
const TaskPlan = require('../models/TaskPlan');
const Repository = require('../models/Repository');
const Execution = require('../models/Execution');
const ExecutionEvent = require('../models/ExecutionEvent');
const executionService = require('../services/executionService');
const { isTaskExecuting, isWorkspaceLocked } = require('../services/executionLock');
const { getExecutionEvents: fetchExecutionEvents } = require('../services/auditService');
const { scrubTokens } = require('../agent/toolExecutors');

// POST /api/tasks/:id/execute
exports.startExecution = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Validate repository ownership
    const repo = await Repository.findOne({ _id: task.repositoryId, userId: req.userId });
    if (!repo) return res.status(403).json({ error: 'Repository access denied' });

    // Allow starting execution if task is awaiting approval or retrying from failed/cancelled state
    const eligibleStatuses = ['AWAITING_APPROVAL', 'FAILED', 'CANCELLED'];
    if (!eligibleStatuses.includes(task.status)) {
      return res.status(400).json({ error: 'Task must be in AWAITING_APPROVAL, FAILED, or CANCELLED state to execute' });
    }

    // Verify approved plan exists and planHash matches
    const plan = await TaskPlan.findOne({ taskId: task._id });
    if (!plan) {
      return res.status(400).json({ error: 'Cannot execute task without a generated plan' });
    }
    if (!task.approvedPlanHash || task.approvedPlanHash !== plan.planHash) {
      return res.status(403).json({ error: 'Plan integrity verification failed. Current plan has not been approved.' });
    }

    // Concurrency lock check
    if (isTaskExecuting(task._id)) {
      return res.status(409).json({ error: 'An execution is already running for this task' });
    }
    if (isWorkspaceLocked(repo._id)) {
      return res.status(409).json({ error: 'Workspace is currently locked by another task execution' });
    }

    const existingExec = await Execution.findOne({ taskId: task._id, status: { $in: ['QUEUED', 'RUNNING', 'VALIDATING'] } });
    if (existingExec) {
      return res.status(409).json({ error: 'An execution is already running for this task' });
    }

    // Run execution asynchronously to not block HTTP response
    executionService.executeTask(task._id, req.userId).catch(console.error);

    res.status(202).json({ message: 'Execution started' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

// GET /api/tasks/:id/execution
exports.getExecution = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const execution = await Execution.findOne({ taskId: task._id }).sort({ createdAt: -1 });
    if (!execution) return res.status(404).json({ error: 'Execution not found' });

    const execData = typeof execution.toObject === 'function' ? execution.toObject() : execution;
    res.json({ ...execData, taskStatus: task.status });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/tasks/:id/execution/cancel
exports.cancelExecution = async (req, res) => {
  try {
    const success = await executionService.cancelExecution(req.params.id, req.userId);
    if (success) {
      res.json({ message: 'Execution cancelled' });
    } else {
      res.status(400).json({ error: 'Execution is not currently running' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

// GET /api/tasks/:id/execution/events
exports.getExecutionEvents = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const execution = await Execution.findOne({ taskId: task._id }).sort({ createdAt: -1 });
    if (!execution) return res.json([]);

    const sinceSequence = (req.query.sinceSequence !== undefined && req.query.sinceSequence !== null && req.query.sinceSequence !== '')
      ? parseInt(req.query.sinceSequence, 10)
      : undefined;
    const result = await fetchExecutionEvents(execution._id, { sinceSequence });
    const events = Array.isArray(result) ? result : (result.events || []);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

// GET /api/tasks/:id/execution/audit
exports.getExecutionAudit = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const execution = await Execution.findOne({ taskId: task._id }).sort({ createdAt: -1 });
    if (!execution) return res.status(404).json({ error: 'Execution not found' });

    const result = await fetchExecutionEvents(execution._id);
    const events = Array.isArray(result) ? result : (result.events || []);

    res.json({
      traceId: execution.traceId,
      executionId: execution._id,
      taskId: task._id,
      taskStatus: task.status,
      executionStatus: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      durationMs: execution.metadata?.durationMs || null,
      failureCategory: execution.metadata?.failureCategory || execution.failureDetails?.category || null,
      failureDetails: execution.failureDetails || null,
      totalEvents: events.length,
      events
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

// GET /api/executions/history
exports.getExecutionHistory = async (req, res) => {
  try {
    const executions = await Execution.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('taskId', 'title status')
      .populate('repositoryId', 'owner name');

    const history = executions.map(exec => ({
      executionId: exec._id,
      taskId: exec.taskId?._id || exec.taskId,
      taskTitle: exec.taskId?.title || 'Unknown Task',
      taskStatus: exec.taskId?.status || exec.status,
      repoName: exec.repositoryId ? `${exec.repositoryId.owner}/${exec.repositoryId.name}` : 'Unknown',
      status: exec.status,
      traceId: exec.traceId,
      failureCategory: exec.metadata?.failureCategory || null,
      durationMs: exec.metadata?.durationMs || null,
      totalSteps: exec.totalSteps,
      currentStep: exec.currentStep,
      startedAt: exec.startedAt,
      completedAt: exec.completedAt,
      createdAt: exec.createdAt
    }));

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

// GET /api/tasks/:id/execution/stream
exports.streamExecutionEvents = async (req, res) => {
  try {
    const taskId = req.params.id;

    // Enforce ownership check before sending any headers
    const task = await Task.findOne({ _id: taskId, userId: req.userId });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Set proper SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    let isClosed = false;
    let highestSeq = 0;
    const queuedEvents = [];
    let replayDone = false;

    const safeWrite = (payload) => {
      if (isClosed || res.writableEnded) return;
      const jsonStr = JSON.stringify(payload);
      const safeData = scrubTokens(jsonStr);
      res.write(`data: ${safeData}\n\n`);
    };

    const cleanup = () => {
      if (isClosed) return;
      isClosed = true;
      executionService.executionEmitter.off(`task:${taskId}`, onLiveEvent);
    };

    const onLiveEvent = (event) => {
      if (isClosed) return;
      if (!replayDone) {
        queuedEvents.push(event);
        return;
      }

      if (event.sequenceNumber) {
        if (event.sequenceNumber <= highestSeq) {
          return;
        }
        highestSeq = event.sequenceNumber;
      }

      safeWrite(event);

      const status = event.status;
      const eventType = event.eventType;
      if (
        ['COMPLETED', 'VERIFIED', 'FAILED', 'CANCELLED'].includes(status) ||
        ['EXECUTION_COMPLETED', 'EXECUTION_FAILED', 'EXECUTION_CANCELLED'].includes(eventType)
      ) {
        cleanup();
        if (!res.writableEnded) {
          res.end();
        }
      }
    };

    // Attach live listener
    executionService.executionEmitter.on(`task:${taskId}`, onLiveEvent);

    // Clean up when client disconnects or response finishes
    res.on('close', cleanup);

    // Replay existing execution logs if present
    const execution = await Execution.findOne({ taskId: task._id }).sort({ createdAt: -1 }).lean();
    if (execution && Array.isArray(execution.executionLogs)) {
      for (const log of execution.executionLogs) {
        if (isClosed) break;
        safeWrite({
          type: 'log',
          eventType: log.stream === 'stderr' ? 'stderr' : (log.stream === 'stdout' ? 'stdout' : 'system'),
          stream: log.stream || 'system',
          text: log.text || '',
          timestamp: log.timestamp || new Date(),
          replayed: true
        });
      }
    }

    // Replay existing ExecutionEvent records
    const historicalEvents = await ExecutionEvent.find({ taskId: task._id })
      .sort({ sequenceNumber: 1 })
      .lean();

    for (const ev of historicalEvents) {
      if (isClosed) break;
      if (ev.sequenceNumber && ev.sequenceNumber > highestSeq) {
        highestSeq = ev.sequenceNumber;
      }
      safeWrite({
        ...ev,
        type: ev.eventType,
        replayed: true
      });
    }

    replayDone = true;

    // Flush any live events that arrived during DB query
    for (const queued of queuedEvents) {
      if (isClosed) break;
      onLiveEvent(queued);
    }

    // If task is already completed/verified/failed/cancelled, terminate stream
    const currentTask = await Task.findById(taskId).select('status').lean();
    if (['COMPLETED', 'VERIFIED', 'FAILED', 'CANCELLED'].includes(currentTask?.status)) {
      cleanup();
      if (!res.writableEnded) {
        res.end();
      }
    }
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Server error' });
    } else {
      if (!res.writableEnded) res.end();
    }
  }
};

