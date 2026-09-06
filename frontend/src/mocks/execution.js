export const mockExecutionLogs = [
  { timestamp: '2026-09-01T09:30:01Z', stream: 'system', text: 'Created isolated git branch: optimus-execution-exec001' },
  { timestamp: '2026-09-01T09:30:02Z', stream: 'system', text: 'Starting Step 1: Create auth middleware module' },
  { timestamp: '2026-09-01T09:30:03Z', stream: 'system', text: 'Executing Tool: read_file({"path":"src/middleware/auth.js"})' },
  { timestamp: '2026-09-01T09:30:05Z', stream: 'stdout', text: 'AI: Reading the current auth middleware to understand the existing structure...' },
  { timestamp: '2026-09-01T09:30:08Z', stream: 'system', text: 'Executing Tool: search_code({"query":"verifyToken"})' },
  { timestamp: '2026-09-01T09:30:10Z', stream: 'system', text: 'Executing Tool: apply_patch({"path":"src/middleware/auth.js","oldText":"function verifyToken...","newText":"function verifyJWT..."})' },
  { timestamp: '2026-09-01T09:30:12Z', stream: 'system', text: 'Executing Tool: complete_step({"summary":"Extracted JWT verification into standalone middleware"})' },
  { timestamp: '2026-09-01T09:30:14Z', stream: 'system', text: 'Starting Step 2: Implement role-based access control' },
  { timestamp: '2026-09-01T09:30:16Z', stream: 'system', text: 'Executing Tool: read_file({"path":"src/models/User.js"})' },
  { timestamp: '2026-09-01T09:30:18Z', stream: 'system', text: 'Executing Tool: apply_patch({"path":"src/middleware/auth.js","oldText":"module.exports","newText":"function requireRole..."})' },
  { timestamp: '2026-09-01T09:30:20Z', stream: 'system', text: 'Executing Tool: complete_step({"summary":"Added requireRole middleware"})' },
  { timestamp: '2026-09-01T09:30:22Z', stream: 'system', text: 'Starting Step 3: Update route definitions' },
  { timestamp: '2026-09-01T09:30:25Z', stream: 'system', text: 'Executing Tool: apply_patch({"path":"src/routes/api.js","oldText":"router.get...","newText":"router.get(\'/users\', verifyJWT, requireRole(\'admin\')..."})' },
  { timestamp: '2026-09-01T09:30:27Z', stream: 'system', text: 'Executing Tool: complete_step({"summary":"Updated all route handlers"})' },
  { timestamp: '2026-09-01T09:30:28Z', stream: 'system', text: 'Starting Step 4: Add error handling and tests' },
  { timestamp: '2026-09-01T09:30:30Z', stream: 'system', text: 'Executing Tool: create_file({"path":"tests/auth.test.js","content":"..."})' },
  { timestamp: '2026-09-01T09:30:32Z', stream: 'system', text: 'Executing Tool: complete_step({"summary":"Added tests and error handling"})' },
  { timestamp: '2026-09-01T09:30:34Z', stream: 'system', text: 'Starting validation phase...' },
  { timestamp: '2026-09-01T09:30:36Z', stream: 'system', text: 'Running validation command (npm install)...' },
  { timestamp: '2026-09-01T09:30:40Z', stream: 'stdout', text: 'Exit Code: 0\nOutput:\nup to date, audited 245 packages in 2s\nfound 0 vulnerabilities' },
  { timestamp: '2026-09-01T09:30:42Z', stream: 'system', text: 'Running validation command (npm test) - Attempt 1...' },
  { timestamp: '2026-09-01T09:30:50Z', stream: 'stdout', text: 'Exit Code: 0\nOutput:\n✓ 12 tests passed\n0 failures' },
  { timestamp: '2026-09-01T09:30:52Z', stream: 'system', text: 'Validation successful!' },
  {
    timestamp: '2026-09-01T09:30:54Z',
    stream: 'system',
    text: `Final Workspace Diff:
diff --git a/src/middleware/auth.js b/src/middleware/auth.js
index 1a2b3c4..5e6f7g8 100644
--- a/src/middleware/auth.js
+++ b/src/middleware/auth.js
@@ -1,15 +1,45 @@
-const jwt = require('jsonwebtoken');
+const jwt = require('jsonwebtoken');
+const { AuthError } = require('../utils/errors');
 
-function verifyToken(req, res, next) {
+function verifyJWT(req, res, next) {
   const token = req.headers.authorization?.split(' ')[1];
-  if (!token) return res.status(401).json({ error: 'No token' });
+  if (!token) throw new AuthError('Missing bearer token');
   try {
     req.user = jwt.verify(token, process.env.JWT_SECRET);
     next();
   } catch (err) {
-    res.status(401).json({ error: 'Invalid token' });
+    throw new AuthError('Invalid or expired token');
   }
 }
+
+function requireRole(...roles) {
+  return (req, res, next) => {
+    if (!req.user || !roles.includes(req.user.role)) {
+      throw new AuthError('Insufficient permissions');
+    }
+    next();
+  };
+}
+
+module.exports = { verifyJWT, requireRole };`
  }
 ];

export const mockExecution = {
  _id: 'exec_001',
  taskId: 'task_001',
  status: 'COMPLETED',
  totalSteps: 4,
  currentStep: 4,
  changedFiles: ['src/middleware/auth.js', 'src/routes/api.js', 'src/utils/errors.js', 'tests/auth.test.js'],
  startedAt: '2026-09-01T09:30:00Z',
  completedAt: '2026-09-01T10:15:00Z',
  error: null,
  executionLogs: mockExecutionLogs
};

export const mockRunningExecution = {
  _id: 'exec_002',
  taskId: 'task_002',
  status: 'RUNNING',
  totalSteps: 4,
  currentStep: 2,
  changedFiles: ['src/middleware/rateLimit.js'],
  startedAt: '2026-09-02T11:45:00Z',
  completedAt: null,
  error: null,
  executionLogs: [
    { timestamp: '2026-09-02T11:45:01Z', stream: 'system', text: 'Created isolated git branch: optimus-execution-exec002' },
    { timestamp: '2026-09-02T11:45:02Z', stream: 'system', text: 'Starting Step 1: Install rate limiting package' },
    { timestamp: '2026-09-02T11:45:05Z', stream: 'system', text: 'Executing Tool: read_file({"path":"package.json"})' },
    { timestamp: '2026-09-02T11:45:08Z', stream: 'system', text: 'Executing Tool: complete_step({"summary":"Verified express-rate-limit dependency"})' },
    { timestamp: '2026-09-02T11:45:10Z', stream: 'system', text: 'Starting Step 2: Configure rate limiting middleware' },
    { timestamp: '2026-09-02T11:45:12Z', stream: 'system', text: 'Executing Tool: read_file({"path":"src/server.js"})' },
    { timestamp: '2026-09-02T11:45:15Z', stream: 'system', text: 'Executing Tool: search_code({"query":"app.use"})' }
  ]
};

export const mockFailedExecution = {
  _id: 'exec_003',
  taskId: 'task_005',
  status: 'FAILED',
  totalSteps: 3,
  currentStep: 2,
  changedFiles: ['src/validation/schemas.js'],
  startedAt: '2026-08-30T16:30:00Z',
  completedAt: '2026-08-30T17:00:00Z',
  error: 'Validation failed after maximum retry attempts.',
  executionLogs: [
    { timestamp: '2026-08-30T16:30:01Z', stream: 'system', text: 'Created isolated git branch: optimus-execution-exec003' },
    { timestamp: '2026-08-30T16:30:02Z', stream: 'system', text: 'Starting Step 1: Create Zod schemas' },
    { timestamp: '2026-08-30T16:30:10Z', stream: 'system', text: 'Executing Tool: complete_step({"summary":"Created validation schemas"})' },
    { timestamp: '2026-08-30T16:30:12Z', stream: 'system', text: 'Starting Step 2: Replace manual validation' },
    { timestamp: '2026-08-30T16:35:00Z', stream: 'system', text: 'Executing Tool: apply_patch(...)' },
    { timestamp: '2026-08-30T16:40:00Z', stream: 'system', text: 'Starting validation phase...' },
    { timestamp: '2026-08-30T16:42:00Z', stream: 'stdout', text: 'Exit Code: 1\nOutput:\nError: Cannot find module \'zod\'' },
    { timestamp: '2026-08-30T16:42:01Z', stream: 'system', text: 'Execution Terminated: Validation failed after maximum retry attempts.' },
    { timestamp: '2026-08-30T16:42:02Z', stream: 'system', text: 'Attempting rollback via git...' },
    { timestamp: '2026-08-30T16:42:03Z', stream: 'system', text: 'Rollback successful.' }
  ]
};

export default {
  mockExecution,
  mockExecutionLogs,
  mockRunningExecution,
  mockFailedExecution
};
