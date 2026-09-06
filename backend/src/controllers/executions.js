const Task = require('../models/Task');
const TaskPlan = require('../models/TaskPlan');
const Repository = require('../models/Repository');
const Execution = require('../models/Execution');
const executionService = require('../services/executionService');
const { isTaskExecuting, isWorkspaceLocked } = require('../services/executionLock');
const { getExecutionEvents: fetchExecutionEvents } = require('../services/auditService');

// POST /api/tasks/:id/execute
exports.startExecution = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Validate repository ownership
    const repo = await Repository.findOne({ _id: task.repositoryId, userId: req.userId });
    if (!repo) return res.status(403).json({ error: 'Repository access denied' });

    if (task.status !== 'AWAITING_APPROVAL') {
      return res.status(400).json({ error: 'Task must be in AWAITING_APPROVAL state to execute' });
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

    const sinceSequence = req.query.sinceSequence ? parseInt(req.query.sinceSequence, 10) : 0;
    const events = await fetchExecutionEvents(execution._id, { sinceSequence });
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

    const events = await fetchExecutionEvents(execution._id);

    res.json({
      traceId: execution.traceId,
      executionId: execution._id,
      taskId: task._id,
      taskStatus: task.status,
      executionStatus: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      durationMs: execution.metadata?.durationMs || null,
      failureCategory: execution.metadata?.failureCategory || null,
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

