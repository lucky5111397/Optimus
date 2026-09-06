const Task = require('../models/Task');
const Execution = require('../models/Execution');
const Repository = require('../models/Repository');

// GET /api/activity
// Derives recent user activity from Task and Execution state changes.
// Returns array sorted by timestamp descending, limited to 30 items.
exports.getActivity = async (req, res) => {
  try {
    // Fetch recent tasks for this user
    const recentTasks = await Task.find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .limit(20)
      .populate('repositoryId', 'owner name');

    // Fetch recent executions for this user
    const recentExecutions = await Execution.find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .limit(15)
      .populate('taskId', 'title');

    const activity = [];

    // Map task state changes to activity items
    for (const task of recentTasks) {
      const repoName = task.repositoryId ? `${task.repositoryId.owner}/${task.repositoryId.name}` : 'Unknown';
      
      if (task.status === 'DELIVERED') {
        activity.push({
          id: `task-delivered-${task._id}`,
          type: 'task_completed',
          title: 'PR Delivered',
          description: task.title,
          timestamp: task.deliveredAt || task.updatedAt,
          repoName
        });
      } else if (task.status === 'COMPLETED' || task.status === 'VERIFIED') {
        activity.push({
          id: `task-completed-${task._id}`,
          type: 'task_completed',
          title: 'Task Completed',
          description: task.title,
          timestamp: task.updatedAt,
          repoName
        });
      } else if (task.status === 'FAILED') {
        activity.push({
          id: `task-failed-${task._id}`,
          type: 'execution_failed',
          title: 'Task Failed',
          description: task.title,
          timestamp: task.updatedAt,
          repoName
        });
      } else if (task.status === 'PLAN_READY') {
        activity.push({
          id: `plan-generated-${task._id}`,
          type: 'plan_generated',
          title: 'Plan Generated',
          description: task.title,
          timestamp: task.updatedAt,
          repoName
        });
      } else if (task.status === 'CONTEXT_READY') {
        activity.push({
          id: `task-created-${task._id}`,
          type: 'task_created',
          title: 'Task Created',
          description: task.title,
          timestamp: task.updatedAt,
          repoName
        });
      }
    }

    // Map execution events to activity items
    for (const exec of recentExecutions) {
      if (exec.status === 'RUNNING') {
        activity.push({
          id: `exec-started-${exec._id}`,
          type: 'execution_started',
          title: 'Execution Started',
          description: exec.taskId?.title || 'Unknown task',
          timestamp: exec.startedAt || exec.updatedAt,
          repoName: ''
        });
      }
    }

    // Sort by timestamp descending and limit
    activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(activity.slice(0, 30));
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
