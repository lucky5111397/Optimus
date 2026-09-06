const crypto = require('crypto');
const Task = require('../models/Task');
const TaskContext = require('../models/TaskContext');
const TaskPlan = require('../models/TaskPlan');
const Repository = require('../models/Repository');
const RepositoryBranch = require('../models/RepositoryBranch');
const { buildPlanningPrompt } = require('../ai/prompts');
const aiGateway = require('../ai/gateway');

function computePlanHash(planData) {
  const normalized = {
    steps: (planData.steps || []).map(s => ({
      title: s.title || '',
      description: s.description || '',
      filesAffected: (s.filesAffected || []).slice().sort()
    })),
    summary: planData.summary || '',
    filesExpectedToChange: (planData.filesExpectedToChange || []).slice().sort(),
    validationStrategy: planData.validationStrategy || '',
    markdown: planData.markdown || ''
  };
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

/**
 * Plans a task by gathering real repository context, generating an AI plan,
 * computing a deterministic planHash, and saving structured plan details.
 *
 * @param {string|ObjectId} taskId - The ID of the task to plan.
 * @param {string|ObjectId} userId - The authenticated user ID for ownership validation.
 * @returns {Promise<{ task: Object, plan: Object }>}
 */
async function planTask(taskId, userId) {
  const query = userId ? { _id: taskId, userId } : { _id: taskId };
  const task = await Task.findOne(query);
  if (!task) {
    throw new Error('Task not found');
  }

  // Validate repository ownership
  const repoQuery = userId ? { _id: task.repositoryId, userId } : { _id: task.repositoryId };
  const repo = await Repository.findOne(repoQuery);
  if (!repo) {
    throw new Error('Repository access denied');
  }

  // Ensure TaskContext is populated with real branch metadata
  let context = await TaskContext.findOne({ taskId: task._id });
  if (!context || !context.fileTree || context.fileTree.length === 0) {
    const branch = await RepositoryBranch.findOne({ repositoryId: repo._id, isDefault: true });
    if (branch && branch.fileIndex) {
      context = await TaskContext.findOneAndUpdate(
        { taskId: task._id },
        {
          taskId: task._id,
          fileTree: branch.fileIndex.fileTree || branch.fileIndex.files || [],
          symbols: branch.fileIndex.symbols || [],
          dependencies: branch.fileIndex.dependencies || []
        },
        { upsert: true, new: true }
      );
    } else if (!context) {
      context = { fileTree: [], symbols: [], dependencies: [] };
    }
  }

  // Transition task to PLANNING and invalidate prior approvals
  task.status = 'PLANNING';
  task.approvedPlanHash = null;
  await task.save();

  try {
    const { systemPrompt, userPrompt } = buildPlanningPrompt(task, context);
    const planData = await aiGateway.generatePlan(systemPrompt, userPrompt);

    const planHash = computePlanHash(planData);

    let plan = await TaskPlan.findOne({ taskId: task._id });
    const nextVersion = plan ? (plan.version || 1) + 1 : 1;

    if (!plan) {
      plan = new TaskPlan({
        taskId: task._id,
        summary: planData.summary || `Implementation plan for ${task.title}`,
        approach: planData.approach || '',
        steps: planData.steps || [],
        filesToInspect: planData.filesToInspect || [],
        filesExpectedToChange: planData.filesExpectedToChange || [],
        implementationDetails: planData.implementationDetails || '',
        assumptions: planData.assumptions || [],
        risks: planData.risks || [],
        validationStrategy: planData.validationStrategy || 'Run validation suite to confirm 0 regressions.',
        markdown: planData.markdown || '### Implementation Plan\n\nNo detailed markdown returned.',
        planHash,
        version: 1,
        generatedAt: new Date(),
        approvedAt: null,
        approvedBy: null
      });
    } else {
      plan.summary = planData.summary || `Implementation plan for ${task.title}`;
      plan.approach = planData.approach || '';
      plan.steps = planData.steps || [];
      plan.filesToInspect = planData.filesToInspect || [];
      plan.filesExpectedToChange = planData.filesExpectedToChange || [];
      plan.implementationDetails = planData.implementationDetails || '';
      plan.assumptions = planData.assumptions || [];
      plan.risks = planData.risks || [];
      plan.validationStrategy = planData.validationStrategy || 'Run validation suite to confirm 0 regressions.';
      plan.markdown = planData.markdown || plan.markdown;
      plan.planHash = planHash;
      plan.version = nextVersion;
      plan.generatedAt = new Date();
      plan.approvedAt = null;
      plan.approvedBy = null;
    }

    await plan.save();

    task.status = 'PLAN_READY';
    task.approvedPlanHash = null;
    await task.save();

    return { task, plan };
  } catch (error) {
    // If planning fails, revert task status to CONTEXT_READY
    task.status = 'CONTEXT_READY';
    await task.save();
    throw error;
  }
}

module.exports = {
  planTask,
  computePlanHash
};
