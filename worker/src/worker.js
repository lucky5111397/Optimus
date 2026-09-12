const express = require('express');
const { executeInSandbox, terminateAllProcesses } = require('./executor');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '1mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'optimus-worker', timestamp: new Date().toISOString() });
});

// Worker info endpoint
app.get('/info', (req, res) => {
  res.status(200).json({
    status: 'ONLINE',
    service: 'optimus-worker',
    workspaceRoot: process.env.WORKSPACES_ROOT || '/tmp/optimus_workspaces'
  });
});

// Execution endpoint
app.post('/execute', async (req, res) => {
  const { command, workspacePath, timeoutMs, maxOutputChars } = req.body || {};

  if (!command || typeof command !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Command parameter is required and must be a string'
    });
  }

  if (!workspacePath || typeof workspacePath !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'workspacePath parameter is required and must be a string'
    });
  }

  try {
    const result = await executeInSandbox(command, workspacePath, { timeoutMs, maxOutputChars });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      exitCode: 1,
      error: err.message,
      output: `Exit Code: 1\nOutput:\nWorker execution error: ${err.message}`
    });
  }
});

let serverInstance = null;

function startWorkerServer(port = PORT) {
  return new Promise((resolve, reject) => {
    const srv = app.listen(port, () => {
      serverInstance = srv;
      resolve(srv);
    });
    srv.on('error', reject);
  });
}

function stopWorkerServer() {
  return new Promise((resolve) => {
    terminateAllProcesses();
    if (serverInstance) {
      serverInstance.close(() => {
        serverInstance = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Graceful process shutdown
process.on('SIGTERM', () => {
  stopWorkerServer().then(() => process.exit(0));
});

process.on('SIGINT', () => {
  stopWorkerServer().then(() => process.exit(0));
});

if (require.main === module) {
  startWorkerServer(PORT).then(() => {
    console.log(`Optimus Worker listening on port ${PORT}`);
  }).catch((err) => {
    console.error('Failed to start Optimus Worker:', err);
    process.exit(1);
  });
}

module.exports = {
  app,
  startWorkerServer,
  stopWorkerServer
};
