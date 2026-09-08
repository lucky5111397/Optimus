const Task = require('../models/Task');
const Execution = require('../models/Execution');
const Repository = require('../models/Repository');

// GET /api/analytics
// Aggregates real metrics from user's data.
exports.getAnalytics = async (req, res) => {
  try {
    const userId = req.userId;

    // Count tasks by status
    const totalTasks = await Task.countDocuments({ userId });
    const completedTasks = await Task.countDocuments({ userId, status: { $in: ['COMPLETED', 'VERIFIED', 'DELIVERED'] } });
    const completedTasks = await Task.countDocuments({ userId, status: { $in: ['COMPLETED', 'VERIFIED', 'DELIVERED', 'MERGED'] } });
    const failedTasks = await Task.countDocuments({ userId, status: 'FAILED' });
    const activeTasks = await Task.countDocuments({ userId, status: { $nin: ['COMPLETED', 'VERIFIED', 'DELIVERED', 'FAILED', 'CANCELLED'] } });
    const activeTasks = await Task.countDocuments({ userId, status: { $nin: ['COMPLETED', 'VERIFIED', 'DELIVERED', 'MERGED', 'CLOSED', 'FAILED', 'CANCELLED'] } });

    // Success rate
    const finishedTasks = completedTasks + failedTasks;
    const successRate = finishedTasks > 0 ? Math.round((completedTasks / finishedTasks) * 1000) / 10 : 0;

    // Execution metrics
    const executions = await Execution.find({ userId, status: 'COMPLETED' }).select('startedAt completedAt changedFiles');
    
    let totalExecutionTimeMs = 0;
    let totalFilesModified = 0;
    for (const exec of executions) {
      if (exec.startedAt && exec.completedAt) {
        totalExecutionTimeMs += new Date(exec.completedAt) - new Date(exec.startedAt);
      }
      totalFilesModified += (exec.changedFiles || []).length;
    }
    
    const avgExecutionTimeSec = executions.length > 0 ? Math.round(totalExecutionTimeMs / executions.length / 1000) : 0;
    const avgExecutionTime = avgExecutionTimeSec >= 60 
      ? `${Math.floor(avgExecutionTimeSec / 60)}m ${avgExecutionTimeSec % 60}s`
      : `${avgExecutionTimeSec}s`;

    // Repository count
    const totalRepos = await Repository.countDocuments({ userId });
    const readyRepos = await Repository.countDocuments({ userId, status: 'READY' });

    // Weekly performance (tasks created per day for last 7 days)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(now.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      const count = await Task.countDocuments({
        userId,
        createdAt: { $gte: dayStart, $lte: dayEnd }
      });
      weeklyData.push({ day: days[dayStart.getDay()], tasks: count });
    }

    res.json({
      totalTasks,
      completedTasks,
      failedTasks,
      activeTasks,
      successRate,
      avgExecutionTime,
      totalFilesModified,
      totalRepos,
      readyRepos,
      weeklyData
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
