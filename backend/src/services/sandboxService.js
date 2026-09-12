const path = require('path');
const axios = require('axios');

const WORKSPACES_DIR = path.resolve(__dirname, '..', '..', 'workspaces');

const ALLOWED_COMMANDS = [
  'npm test',
  'npm run build',
  'npm run lint',
  'npm install'
];

/**
 * Redacts tokens, URIs, and credentials from subprocess outputs.
 */
function scrubTokens(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/(gh[pousr]_[a-zA-Z0-9]{20,80}|github_pat_[a-zA-Z0-9_]{20,100})/gi, '[REDACTED_GITHUB_TOKEN]')
    .replace(/(sk-or-v1-[a-zA-Z0-9]{20,80}|sk-[a-zA-Z0-9]{20,80})/gi, '[REDACTED_API_KEY]')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, '[REDACTED_MONGODB_URI]')
    .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]');
}

/**
 * Validates that workspace path is strictly contained inside the workspaces directory.
 */
function validateSandboxWorkspace(workspacePath) {
  if (!workspacePath || typeof workspacePath !== 'string' || workspacePath.includes('\0')) {
    throw new Error('Invalid workspace path provided to sandbox');
  }

  const resolvedTarget = path.resolve(workspacePath);
  const backendWorkspaces = path.resolve(__dirname, '..', '..', 'workspaces');
  const rootWorkspaces = path.resolve(__dirname, '..', '..', '..', 'workspaces');

  const validRoots = [backendWorkspaces, rootWorkspaces];
  const isContained = validRoots.some(root => {
    const withSep = root.endsWith(path.sep) ? root : root + path.sep;
    return resolvedTarget !== root && resolvedTarget.startsWith(withSep);
  });

  if (!isContained) {
    throw new Error('Sandbox violation: Execution outside isolated workspace directory is forbidden');
  }

  return resolvedTarget;
}

/**
 * Validates command against strict whitelist and shell injection characters.
 */
function validateSandboxCommand(command) {
  if (!command || typeof command !== 'string') {
    throw new Error('Invalid sandbox command');
  }

  const trimmed = command.trim();

  // Reject shell metacharacters and chaining
  const forbiddenChars = [';', '&', '|', '`', '$', '>', '<', '\n', '\r'];
  for (const char of forbiddenChars) {
    if (trimmed.includes(char)) {
      throw new Error(`Sandbox violation: Shell metacharacter '${char}' is forbidden in sandbox execution`);
    }
  }

  // Enforce whitelist
  const isAllowed = ALLOWED_COMMANDS.some(allowed => 
    trimmed === allowed || trimmed.startsWith(allowed + ' ')
  );

  if (!isAllowed) {
    throw new Error('Command not allowed. Allowed: ' + ALLOWED_COMMANDS.join(', '));
  }

  return trimmed;
}

/**
 * Constructs a sterile environment containing ONLY whitelisted operating system variables.
 * Explicitly strips all host application secrets, database URIs, API keys, and credentials.
 */
function buildSterileEnvironment(workspacePath) {
  const sterileEnv = {
    // Operating system runtime paths
    PATH: process.env.PATH || '',
    SYSTEMROOT: process.env.SYSTEMROOT || '',
    COMSPEC: process.env.COMSPEC || '',
    TEMP: process.env.TEMP || '',
    TMP: process.env.TMP || '',

    // Confinement flags
    NODE_ENV: 'test',
    CI: 'true',
    NO_COLOR: '1',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false',

    // Confine HOME to prevent reading host ~/.ssh, ~/.gitconfig, ~/.npmrc
    HOME: workspacePath,
    USERPROFILE: workspacePath
  };

  return sterileEnv;
}

let localWorkerServer = null;

/**
 * Ensures worker service is reachable before dispatching execution requests.
 * In local test/benchmark mode, starts local worker instance if not already running.
 */
async function ensureWorkerAvailable(workerUrl) {
  try {
    const healthUrl = `${workerUrl}/health`;
    const res = await axios.get(healthUrl, { timeout: 1000 });
    if (res.status === 200) return true;
  } catch (_) {}

  // Only bootstrap local worker if using default local URL (port 8080) and not an explicit custom WORKER_URL
  const isDefaultLocal = (!process.env.WORKER_URL || process.env.WORKER_URL === 'http://127.0.0.1:8080' || process.env.WORKER_URL === 'http://localhost:8080') && (workerUrl.includes('localhost:8080') || workerUrl.includes('127.0.0.1:8080'));
  if (isDefaultLocal && !localWorkerServer) {
    try {
      const { startWorkerServer } = require('../../../worker/src/worker');
      localWorkerServer = await startWorkerServer(8080);
      return true;
    } catch (_) {}
  }
  return false;
}

/**
 * Executes a validation command inside the isolated worker sandbox via HTTP POST /execute.
 * Untrusted repository code is NEVER executed directly on the backend host.
 */
async function runInSandbox(command, workspacePath, options = {}) {
  const validatedWorkspace = validateSandboxWorkspace(workspacePath);
  const validatedCommand = validateSandboxCommand(command);

  const timeoutMs = Math.min(Math.max(options.timeoutMs || 60000, 1000), 120000);
  const maxOutputChars = options.maxOutputChars || 50000;
  const workerUrl = (process.env.WORKER_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');

  await ensureWorkerAvailable(workerUrl);

  try {
    const response = await axios.post(
      `${workerUrl}/execute`,
      {
        command: validatedCommand,
        workspacePath: validatedWorkspace,
        timeoutMs,
        maxOutputChars
      },
      {
        timeout: timeoutMs + 5000,
        validateStatus: () => true
      }
    );

    const data = response.data || {};
    const passed = response.status === 200 && data.passed === true;
    const exitCode = typeof data.exitCode === 'number' ? data.exitCode : (passed ? 0 : 1);
    const stdout = scrubTokens(data.stdout || '');
    const stderr = scrubTokens(data.stderr || data.error || '');
    const durationMs = data.durationMs || 0;
    const timedOut = !!data.timedOut;

    const outputText = data.output
      ? scrubTokens(data.output)
      : `Exit Code: ${timedOut ? 'TIMED_OUT (-1)' : exitCode}\nOutput:\n${stdout}${stderr ? ('\n' + stderr) : ''}`;

    return {
      exitCode,
      stdout,
      stderr,
      passed,
      durationMs,
      timedOut,
      command: validatedCommand,
      output: outputText,
      toString() { return this.output; }
    };
  } catch (err) {
    const isTimeout = err.code === 'ECONNABORTED' || (err.message && err.message.includes('timeout'));
    const exitCode = isTimeout ? -1 : 1;
    const errSummary = isTimeout
      ? 'Worker execution timed out'
      : `Worker service is unavailable (${err.message})`;
    const outputText = `Exit Code: ${isTimeout ? 'TIMED_OUT (-1)' : 1}\nOutput:\nWorker execution error: ${errSummary}`;

    return {
      exitCode,
      stdout: '',
      stderr: errSummary,
      passed: false,
      durationMs: isTimeout ? timeoutMs : 0,
      timedOut: isTimeout,
      command: validatedCommand,
      output: outputText,
      toString() { return this.output; }
    };
  }
}

module.exports = {
  runInSandbox,
  validateSandboxWorkspace,
  validateSandboxCommand,
  buildSterileEnvironment,
  scrubTokens,
  ALLOWED_COMMANDS
};
