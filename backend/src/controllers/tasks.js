const Task = require('../models/Task');
const TaskContext = require('../models/TaskContext');
const TaskPlan = require('../models/TaskPlan');
const Execution = require('../models/Execution');
const ExecutionEvent = require('../models/ExecutionEvent');
const Repository = require('../models/Repository');
const RepositoryBranch = require('../models/RepositoryBranch');

// GET /api/tasks
exports.listTasks = async (req, res) => {
  const { repositoryId, limit } = req.query;
  
  try {
    let query = { userId: req.userId };
    
    if (repositoryId) {
      // Authorize repository ownership
      const repo = await Repository.findOne({ _id: repositoryId, userId: req.userId });
      if (!repo) {
        return res.status(403).json({ error: 'Repository access denied' });
      }
      query.repositoryId = repositoryId;
    }

    let queryBuilder = Task.find(query).sort({ updatedAt: -1 }).populate('repositoryId', 'owner name');
    
    if (limit) {
      queryBuilder = queryBuilder.limit(parseInt(limit, 10));
    }
    
    const tasks = await queryBuilder.exec();
    res.json(tasks);
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/tasks
exports.createTask = async (req, res) => {
  const { repositoryId, title, description, priority } = req.body;

  if (!repositoryId || !title) {
    return res.status(400).json({ error: 'repositoryId and title are required' });
  }

  try {
    const repo = await Repository.findOne({ _id: repositoryId, userId: req.userId });
    if (!repo) {
      return res.status(403).json({ error: 'Repository access denied' });
    }

    const task = new Task({
      repositoryId,
      userId: req.userId,
      title,
      description,
      priority: priority || 'MEDIUM',
      status: 'ANALYZING'
    });
    
    await task.save();

    // Fetch the latest branch index
    const branch = await RepositoryBranch.findOne({ repositoryId: repo._id, isDefault: true });
    let fileTree = [];
    let symbols = [];
    let dependencies = [];

    if (branch && branch.fileIndex) {
      fileTree = branch.fileIndex.fileTree || branch.fileIndex.files || [];
      symbols = branch.fileIndex.symbols || [];
      dependencies = branch.fileIndex.dependencies || [];
    }

    await TaskContext.findOneAndUpdate(
      { taskId: task._id },
      { taskId: task._id, fileTree, symbols, dependencies },
      { upsert: true, new: true }
    );

    // Update status to CONTEXT_READY
    task.status = 'CONTEXT_READY';
    await task.save();

    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/tasks/:id
exports.getTask = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId }).populate('repositoryId');
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/tasks/:id/context
exports.getTaskContext = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const context = await TaskContext.findOne({ taskId: task._id });
    res.json(context || { fileTree: [], symbols: [], dependencies: [] });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const orchestrator = require('../services/orchestrator');

// POST /api/tasks/:id/plan
exports.generatePlan = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Validate repository ownership
    const repo = await Repository.findOne({ _id: task.repositoryId, userId: req.userId });
    if (!repo) return res.status(403).json({ error: 'Repository access denied' });

    const { plan } = await orchestrator.planTask(task._id, req.userId);
    res.json(plan);
  } catch (error) {
    console.error('generatePlan controller error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

// GET /api/tasks/:id/plan
exports.getTaskPlan = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const plan = await TaskPlan.findOne({ taskId: task._id });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/tasks/:id/approve
exports.approvePlan = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (task.status !== 'PLAN_READY') {
      return res.status(400).json({ error: 'Task must be in PLAN_READY state to approve' });
    }

    const plan = await TaskPlan.findOne({ taskId: task._id });
    if (!plan) {
      return res.status(404).json({ error: 'No plan found to approve' });
    }

    // Plan integrity: verify incoming planHash if provided
    const { planHash } = req.body || {};
    if (planHash && planHash !== plan.planHash) {
      return res.status(409).json({
        error: 'Plan has changed since viewed. Please review the updated plan before approving.',
        currentPlanHash: plan.planHash
      });
    }

    plan.approvedAt = new Date();
    plan.approvedBy = req.userId;
    await plan.save();

    task.approvedPlanHash = plan.planHash;
    task.status = 'AWAITING_APPROVAL';
    await task.save();

    res.json({ message: 'Plan approved', task, plan });
  } catch (error) {
    console.error('approvePlan error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

// POST /api/tasks/:id/reject
exports.rejectPlan = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (!['PLAN_READY', 'AWAITING_APPROVAL'].includes(task.status)) {
      return res.status(400).json({ error: 'Task cannot be rejected from its current state' });
    }

    const plan = await TaskPlan.findOne({ taskId: task._id });
    if (plan) {
      plan.approvedAt = null;
      plan.approvedBy = null;
      await plan.save();
    }

    task.approvedPlanHash = null;
    task.status = 'CONTEXT_READY';
    await task.save();

    res.json({ message: 'Plan rejected. Task returned to context review.', task });
  } catch (error) {
    console.error('rejectPlan error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

// GET /api/tasks/:id/report
exports.getReport = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId })
      .populate('repositoryId', 'owner name');
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const plan = await TaskPlan.findOne({ taskId: task._id });
    const execution = await Execution.findOne({ taskId: task._id }).sort({ createdAt: -1 });

    let timeElapsed = 'N/A';
    if (execution && execution.startedAt && execution.completedAt) {
      const diffSec = Math.round((new Date(execution.completedAt) - new Date(execution.startedAt)) / 1000);
      timeElapsed = diffSec >= 60 ? `${Math.floor(diffSec / 60)}m ${diffSec % 60}s` : `${diffSec}s`;
    }

    res.json({
      task: {
        _id: task._id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        prUrl: task.prUrl || null,
        prNumber: task.prNumber || null,
        deliveryBranch: task.deliveryBranch || null,
        deliveredAt: task.deliveredAt || null,
        deliveryStatus: task.deliveryStatus || null
      },
      repository: task.repositoryId ? {
        owner: task.repositoryId.owner,
        name: task.repositoryId.name
      } : null,
      plan: plan ? {
        steps: plan.steps,
        assumptions: plan.assumptions,
        markdown: plan.markdown
      } : null,
      execution: execution ? {
        status: execution.status,
        timeElapsed,
        changedFiles: execution.changedFiles || [],
        totalSteps: execution.totalSteps,
        completedAt: execution.completedAt,
        error: execution.error || null
      } : null
    });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const deliveryService = require('../services/deliveryService');

// GET /api/tasks/:id/review
exports.getTaskReview = async (req, res) => {
  try {
    const reviewData = await deliveryService.generateExecutionReview(req.params.id, req.userId);
    res.json(reviewData);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || 'Server error' });
  }
};

// POST /api/tasks/:id/deliver
exports.deliverTask = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (task.status === 'DELIVERED') {
      return res.json({
        message: 'PR already created',
        prUrl: task.prUrl,
        prNumber: task.prNumber,
        deliveryBranch: task.deliveryBranch,
        alreadyDelivered: true
      });
    }

    if (task.status !== 'VERIFIED') {
      return res.status(400).json({ error: 'Task is not in VERIFIED state' });
    }

    const result = await deliveryService.deliverTaskToGithub(req.params.id, req.userId);
    res.json(result);
  } catch (error) {
    console.error('Deliver error:', error.message);
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || 'Failed to create Pull Request' });
  }
};

// POST /api/tasks/:id/sync
// On-demand synchronization of PR state and CI check runs from GitHub REST API
exports.syncTaskPR = async (req, res) => {
  try {
    const result = await deliveryService.syncTaskPullRequestStatus(req.params.id, req.userId);
    res.json(result);
  } catch (error) {
    console.error('Sync PR error:', error.message);
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || 'Failed to sync PR status' });
  }
};

// DELETE /api/tasks/:id
// Deletes a task and cascades to associated TaskContext, TaskPlan, Execution, and ExecutionEvent records
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await Promise.all([
      ExecutionEvent.deleteMany({ taskId: task._id }),
      Execution.deleteMany({ taskId: task._id }),
      TaskPlan.deleteMany({ taskId: task._id }),
      TaskContext.deleteMany({ taskId: task._id }),
      Task.deleteOne({ _id: task._id })
    ]);

    return res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    return res.status(500).json({ error: 'Failed to delete task' });
  }
};
