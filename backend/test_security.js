const path = require('path');
const fs = require('fs');
const { executeTool } = require('./src/agent/toolExecutors');
const { validateSandboxWorkspace, runInSandbox } = require('./src/services/sandboxService');
const workspacePath = path.resolve(__dirname, 'workspaces', 'test-repo');

async function testSecurity() {
  let failed = false;
  fs.mkdirSync(workspacePath, { recursive: true });

  const r1 = await executeTool('read_file', { path: '../../.env' }, workspacePath);
  if (r1.includes('Error:')) console.log('PASS: Path traversal blocked -', r1);
  else { console.error('FAIL: Path traversal allowed!'); failed = true; }

  const r2 = await executeTool('read_file', { path: '.env' }, workspacePath);
  if (r2.includes('Error:')) console.log('PASS: .env blocked -', r2);
  else { console.error('FAIL: .env access allowed!'); failed = true; }

  const r3 = await executeTool('run_validation', { command: 'rm -rf /' }, workspacePath);
  if (r3.includes('Error:')) console.log('PASS: Command blocked -', r3);
  else { console.error('FAIL: Arbitrary command allowed!'); failed = true; }

  // Sandbox workspace isolation tests
  try {
    const valid = validateSandboxWorkspace(workspacePath);
    if (valid === workspacePath) {
      console.log('PASS: Valid workspace inside workspaces root allowed');
    } else {
      console.error('FAIL: Valid workspace returned unexpected path:', valid);
      failed = true;
    }
  } catch (err) {
    console.error('FAIL: Valid workspace unexpectedly rejected:', err.message);
    failed = true;
  }

  // Reject external path containing 'scratch'
  try {
    validateSandboxWorkspace(path.resolve(__dirname, '..', 'scratch'));
    console.error('FAIL: External scratch path was allowed!');
    failed = true;
  } catch (err) {
    if (err.message.includes('Sandbox violation')) {
      console.log('PASS: External scratch path rejected -', err.message);
    } else {
      console.error('FAIL: Unexpected error for external scratch path:', err.message);
      failed = true;
    }
  }

  // Reject external path containing 'test_workspace' even when NODE_ENV is 'test'
  const originalEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'test';
    validateSandboxWorkspace(path.resolve(__dirname, '..', 'test_workspace'));
    console.error('FAIL: External test_workspace was allowed in test mode!');
    failed = true;
  } catch (err) {
    if (err.message.includes('Sandbox violation')) {
      console.log('PASS: External test_workspace rejected in test mode -', err.message);
    } else {
      console.error('FAIL: Unexpected error for test_workspace:', err.message);
      failed = true;
    }
  } finally {
    process.env.NODE_ENV = originalEnv;
  }

  // Worker Unavailability Failure Handling Test
  const prevWorkerUrl = process.env.WORKER_URL;
  try {
    process.env.WORKER_URL = 'http://127.0.0.1:59999'; // Non-existent worker port
    const unreachableRes = await runInSandbox('npm test', workspacePath, { timeoutMs: 2000 });
    if (unreachableRes.passed === false && unreachableRes.exitCode === 1 && unreachableRes.stderr.includes('unavailable')) {
      console.log('PASS: Worker unavailability handled safely with structured error');
    } else {
      console.error('FAIL: Worker unavailability did not return expected structured error:', unreachableRes);
      failed = true;
    }
  } catch (err) {
    console.error('FAIL: Worker unavailability threw unhandled exception:', err);
    failed = true;
  } finally {
    if (prevWorkerUrl) process.env.WORKER_URL = prevWorkerUrl;
    else delete process.env.WORKER_URL;
  }

  // Backend Host Spawn Elimination Audit
  const sandboxServiceSource = fs.readFileSync(path.resolve(__dirname, 'src', 'services', 'sandboxService.js'), 'utf8');
  if (sandboxServiceSource.includes("require('child_process')") || sandboxServiceSource.includes('child_process.spawn')) {
    console.error('FAIL: sandboxService.js still imports or uses child_process!');
    failed = true;
  } else {
    console.log('PASS: sandboxService.js completely eliminates direct child_process usage');
  }

  if (failed) {
    process.exit(1);
  }
}

testSecurity();
