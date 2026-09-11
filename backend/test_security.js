const path = require('path');
const { executeTool } = require('./src/agent/toolExecutors');
const { validateSandboxWorkspace } = require('./src/services/sandboxService');
const workspacePath = path.resolve(__dirname, 'workspaces', 'test-repo');

async function testSecurity() {
  let failed = false;
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

  if (failed) {
    process.exit(1);
  }
}

testSecurity();

