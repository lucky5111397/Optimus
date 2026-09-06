const path = require('path');
const { executeTool } = require('./src/agent/toolExecutors');
const workspacePath = path.resolve(__dirname, 'workspaces', 'test-repo');

async function testSecurity() {
  const r1 = await executeTool('read_file', { path: '../../.env' }, workspacePath);
  if (r1.includes('Error:')) console.log('PASS: Path traversal blocked -', r1);
  else console.error('FAIL: Path traversal allowed!');

  const r2 = await executeTool('read_file', { path: '.env' }, workspacePath);
  if (r2.includes('Error:')) console.log('PASS: .env blocked -', r2);
  else console.error('FAIL: .env access allowed!');

  const r3 = await executeTool('run_validation', { command: 'rm -rf /' }, workspacePath);
  if (r3.includes('Error:')) console.log('PASS: Command blocked -', r3);
  else console.error('FAIL: Arbitrary command allowed!');
}

testSecurity();

