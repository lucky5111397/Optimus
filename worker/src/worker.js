const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Optimus Worker listening on port ${PORT}`);
});
