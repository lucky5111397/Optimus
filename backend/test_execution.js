require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const { spawnSync } = require('child_process');
const mongoose = require('mongoose');
const Task = require('./src/models/Task');
const TaskPlan = require('./src/models/TaskPlan');
const Execution = require('./src/models/Execution');
const { executeTask } = require('./src/services/executionService');
const { computePlanHash } = require('./src/services/orchestrator');

// Use a mock Repository model to bypass populate checks without touching the real DB collection
const mockRepoId = new mongoose.Types.ObjectId();
const mockUserId = new mongoose.Types.ObjectId();
const workspacePath = path.resolve(__dirname, 'workspaces', mockRepoId.toString());

async function setup() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/optimus');
  
  // 1. Setup workspace
  await fs.mkdir(workspacePath, { recursive: true });
  spawnSync('git', ['init'], { cwd: workspacePath });
  await fs.writeFile(path.join(workspacePath, 'index.js'), 'console.log("hello world");\n', 'utf8');
  await fs.writeFile(path.join(workspacePath, 'package.json'), JSON.stringify({
    name: "test",
    scripts: { "test": "echo 'tests passed'" }
  }), 'utf8');
  spawnSync('git', ['add', '.'], { cwd: workspacePath });
  spawnSync('git', ['commit', '-m', 'initial'], { cwd: workspacePath });

  // 2. Mock Repository
  // We'll insert a fake repo into the DB for `Repository.findById` to work
  const Repository = require('./src/models/Repository');
  await Repository.create({
    _id: mockRepoId,
    userId: mockUserId,
    provider: 'github',
    owner: 'test',
    name: 'test',
    status: 'READY'
  });

  // 3. Plan Data & Hash
  const planSteps = [{
    title: 'step 1',
    description: 'change hello world to hello agent',
    filesAffected: ['index.js']
  }];
  const planMarkdown = 'test';
  const planHash = computePlanHash({ markdown: planMarkdown, steps: planSteps });

  // 4. Create Task
  const task = new Task({
    repositoryId: mockRepoId,
    userId: mockUserId,
    title: 'test end to end execution',
    status: 'AWAITING_APPROVAL',
    approvedPlanHash: planHash
  });
  await task.save();

  // 5. Create Plan
  const plan = new TaskPlan({
    taskId: task._id,
    markdown: planMarkdown,
    planHash,
    steps: planSteps
  });
  await plan.save();

  console.log('Setup complete. Executing task...');
  
  // 5. Execute
  await executeTask(task._id, mockUserId);
  
  // 6. Verify Execution
  const execution = await Execution.findOne({ taskId: task._id });
  console.log('Execution Status:', execution.status);
  console.log('Logs:', execution.executionLogs.map(l => `[${l.stream}] ${l.text}`).join('\n'));
  
  process.exit(0);
}

setup().catch(err => {
  console.error(err);
  process.exit(1);
});

