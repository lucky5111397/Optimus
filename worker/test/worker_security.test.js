const path = require('path');
const fs = require('fs');
const http = require('http');
const { startWorkerServer, stopWorkerServer } = require('../src/worker');
const { validateAndParseCommand, ALLOWED_COMMANDS } = require('../src/runners');
const { validateWorkspacePath, buildSterileEnvironment } = require('../src/executor');

const TEST_PORT = 9099;
const WORKER_URL = `http://127.0.0.1:${TEST_PORT}`;

function postJson(urlPath, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const req = http.request(
      `${WORKER_URL}${urlPath}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, rawBody: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  let failed = false;
  console.log('--- Starting Worker Security & Isolation Test Suite ---');

  // Setup temporary test workspace inside backend/workspaces
  const testWorkspace = path.resolve(__dirname, '..', '..', 'backend', 'workspaces', 'worker-test-repo');
  fs.mkdirSync(testWorkspace, { recursive: true });

  const pkgJsonPath = path.join(testWorkspace, 'package.json');
  fs.writeFileSync(pkgJsonPath, JSON.stringify({
    name: 'worker-test',
    version: '1.0.0',
    scripts: {
      test: 'echo "Worker Test OK"'
    }
  }, null, 2));

  // 1. Direct Runner Unit Tests: Allowlist & Metacharacter Rejection
  console.log('\n[Test 1] Runner Command Allowlist & Shell Metacharacters:');
  try {
    validateAndParseCommand('rm -rf /');
    console.error('FAIL: Unlisted command was permitted!');
    failed = true;
  } catch (e) {
    console.log('PASS: Unlisted command rejected -', e.message);
  }

  try {
    validateAndParseCommand('npm test; cat /etc/passwd');
    console.error('FAIL: Semicolon injection was permitted!');
    failed = true;
  } catch (e) {
    console.log('PASS: Semicolon injection rejected -', e.message);
  }

  try {
    validateAndParseCommand('npm test && rm -rf /');
    console.error('FAIL: Ampersand injection was permitted!');
    failed = true;
  } catch (e) {
    console.log('PASS: Ampersand injection rejected -', e.message);
  }

  try {
    validateAndParseCommand('npm test | grep secret');
    console.error('FAIL: Pipe injection was permitted!');
    failed = true;
  } catch (e) {
    console.log('PASS: Pipe injection rejected -', e.message);
  }

  try {
    validateAndParseCommand('npm test `whoami`');
    console.error('FAIL: Backtick injection was permitted!');
    failed = true;
  } catch (e) {
    console.log('PASS: Backtick injection rejected -', e.message);
  }

  try {
    validateAndParseCommand('npm test $SECRET');
    console.error('FAIL: Dollar variable expansion was permitted!');
    failed = true;
  } catch (e) {
    console.log('PASS: Dollar variable expansion rejected -', e.message);
  }

  const validParsed = validateAndParseCommand('npm test');
  if (validParsed && validParsed.runner === 'node') {
    console.log('PASS: Valid npm test parsed correctly');
  } else {
    console.error('FAIL: Valid npm test failed to parse');
    failed = true;
  }

  // 2. Direct Executor Unit Tests: Workspace Path Containment
  console.log('\n[Test 2] Workspace Path Containment & Traversal:');
  try {
    validateWorkspacePath(path.resolve(__dirname, '..', '..', 'scratch'));
    console.error('FAIL: Scratch path outside workspaces was permitted!');
    failed = true;
  } catch (e) {
    console.log('PASS: Scratch path outside workspaces rejected -', e.message);
  }

  try {
    validateWorkspacePath(testWorkspace + '\0evil');
    console.error('FAIL: Null byte path traversal was permitted!');
    failed = true;
  } catch (e) {
    console.log('PASS: Null byte path rejected -', e.message);
  }

  try {
    const validTarget = validateWorkspacePath(testWorkspace);
    if (validTarget === testWorkspace) {
      console.log('PASS: Valid workspace directory permitted');
    } else {
      console.error('FAIL: Valid workspace returned unexpected path:', validTarget);
      failed = true;
    }
  } catch (e) {
    console.error('FAIL: Valid workspace unexpectedly rejected:', e.message);
    failed = true;
  }

  // 3. Direct Sterile Environment Unit Tests
  console.log('\n[Test 3] Sterile Environment Construction:');
  process.env.TEST_SECRET_API_KEY = 'sk-super-secret-12345';
  process.env.MONGODB_URI = 'mongodb://user:pass@remote:27017/db';
  const sterile = buildSterileEnvironment(testWorkspace);

  if (sterile.TEST_SECRET_API_KEY || sterile.MONGODB_URI) {
    console.error('FAIL: Host secrets leaked into sterile environment!');
    failed = true;
  } else {
    console.log('PASS: Host secrets stripped from sterile environment');
  }

  if (sterile.NODE_ENV === 'test' && sterile.CI === 'true' && sterile.HOME === testWorkspace) {
    console.log('PASS: Confinement flags and HOME isolation properly configured');
  } else {
    console.error('FAIL: Confinement flags missing in sterile environment:', sterile);
    failed = true;
  }

  // 4. HTTP Endpoint Integration Tests
  console.log('\n[Test 4] Worker HTTP Service (POST /execute):');
  let server;
  try {
    server = await startWorkerServer(TEST_PORT);

    // Test health check
    const healthRes = await new Promise((resolve) => {
      http.get(`${WORKER_URL}/health`, (res) => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => resolve(JSON.parse(b)));
      });
    });

    if (healthRes.status === 'OK') {
      console.log('PASS: Worker /health endpoint responded OK');
    } else {
      console.error('FAIL: /health returned unexpected response:', healthRes);
      failed = true;
    }

    // Test rejection of arbitrary command via HTTP
    const badCmdRes = await postJson('/execute', {
      command: 'cat /etc/passwd',
      workspacePath: testWorkspace
    });
    if (badCmdRes.status === 400 && !badCmdRes.body.success) {
      console.log('PASS: Disallowed command rejected via HTTP (400)');
    } else {
      console.error('FAIL: Disallowed command was not rejected:', badCmdRes);
      failed = true;
    }

    // Test rejection of path traversal via HTTP
    const badPathRes = await postJson('/execute', {
      command: 'npm test',
      workspacePath: path.resolve(__dirname, '..', '..', 'scratch')
    });
    if (badPathRes.status === 400 && !badPathRes.body.success) {
      console.log('PASS: Path traversal rejected via HTTP (400)');
    } else {
      console.error('FAIL: Path traversal was not rejected:', badPathRes);
      failed = true;
    }

    // Test successful execution of npm test in test repo
    const execRes = await postJson('/execute', {
      command: 'npm test',
      workspacePath: testWorkspace,
      timeoutMs: 10000
    });

    if (execRes.status === 200 && execRes.body.passed) {
      console.log('PASS: Allowed npm test executed successfully inside sandbox');
    } else {
      console.error('FAIL: Allowed npm test failed execution:', execRes);
      failed = true;
    }

    // Test timeout enforcement
    const timeoutWorkspace = path.resolve(__dirname, '..', '..', 'backend', 'workspaces', 'worker-timeout-repo');
    fs.mkdirSync(timeoutWorkspace, { recursive: true });
    fs.writeFileSync(path.join(timeoutWorkspace, 'package.json'), JSON.stringify({
      name: 'worker-timeout',
      version: '1.0.0',
      scripts: {
        test: 'node -e "setTimeout(() => console.log(\'done\'), 10000);"'
      }
    }, null, 2));

    const timeoutRes = await postJson('/execute', {
      command: 'npm test',
      workspacePath: timeoutWorkspace,
      timeoutMs: 1500
    });

    if (timeoutRes.body.timedOut && timeoutRes.body.exitCode === -1) {
      console.log('PASS: Execution timeout cleanly enforced and process killed');
    } else {
      console.error('FAIL: Timeout was not properly enforced:', timeoutRes);
      failed = true;
    }

    // Cleanup timeout repo
    fs.rmSync(timeoutWorkspace, { recursive: true, force: true });

  } catch (err) {
    console.error('FAIL: Worker HTTP test encountered unexpected error:', err);
    failed = true;
  } finally {
    await stopWorkerServer();
    // Cleanup test workspace
    try {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    } catch (_) {}
  }

  console.log('\n--- Worker Security Test Suite Complete ---');
  if (failed) {
    process.exit(1);
  } else {
    console.log('All Worker Security Tests PASSED ✅');
  }
}

runTests();
