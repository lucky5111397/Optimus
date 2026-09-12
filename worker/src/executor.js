const path = require('path');
const { spawn } = require('child_process');
const { validateAndParseCommand } = require('./runners');

const activeChildProcesses = new Set();

/**
 * Scrubs tokens, URIs, and credentials from subprocess outputs.
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
 * Validates workspace path against authorized root directories.
 */
function validateWorkspacePath(workspacePath) {
  if (!workspacePath || typeof workspacePath !== 'string' || workspacePath.includes('\0')) {
    throw new Error('Invalid workspace path provided to worker');
  }

  const resolvedTarget = path.resolve(workspacePath);

  const configuredRoot = process.env.WORKSPACES_ROOT ? path.resolve(process.env.WORKSPACES_ROOT) : null;
  const backendWorkspaces = path.resolve(__dirname, '..', '..', 'backend', 'workspaces');
  const rootWorkspaces = path.resolve(__dirname, '..', '..', 'workspaces');
  const containerWorkspaces = path.resolve('/tmp/optimus_workspaces');

  const validRoots = [configuredRoot, backendWorkspaces, rootWorkspaces, containerWorkspaces].filter(Boolean);

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
 * Constructs a sterile environment containing ONLY essential runtime OS variables.
 * Explicitly strips all host application secrets, database URIs, API keys, and credentials.
 */
function buildSterileEnvironment(workspacePath) {
  return {
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
}

/**
 * Safely terminates a process and its child process tree.
 */
function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', pid.toString(), '/T', '/F'], { shell: false });
    } else {
      process.kill(-pid, 'SIGTERM');
    }
  } catch (_) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch (_) {}
  }
}

/**
 * Terminates all currently active child processes spawned by this worker.
 */
function terminateAllProcesses() {
  for (const proc of activeChildProcesses) {
    if (proc.pid) {
      killProcessTree(proc.pid);
    }
  }
  activeChildProcesses.clear();
}

/**
 * Executes an allowed command inside the sandboxed workspace.
 */
async function executeInSandbox(command, workspacePath, options = {}) {
  const validatedWorkspace = validateWorkspacePath(workspacePath);
  const parsed = validateAndParseCommand(command);

  const timeoutMs = Math.min(Math.max(options.timeoutMs || 60000, 1000), 120000);
  const maxOutputChars = options.maxOutputChars || 50000;

  const sterileEnv = buildSterileEnvironment(validatedWorkspace);
  const startTime = Date.now();
  let timedOut = false;

  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(parsed.executable, parsed.args, {
        cwd: validatedWorkspace,
        env: sterileEnv,
        shell: false,
        windowsHide: true
      });
    } catch (spawnErr) {
      const durationMs = Date.now() - startTime;
      const errSummary = `Exit Code: 1\nOutput:\nSandbox spawn error: ${spawnErr.message}`;
      return resolve({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: spawnErr.message,
        passed: false,
        durationMs,
        timedOut: false,
        command: parsed.rawCommand,
        output: errSummary,
        toString() { return this.output; }
      });
    }

    activeChildProcesses.add(proc);

    const timer = setTimeout(() => {
      timedOut = true;
      if (proc.pid) {
        killProcessTree(proc.pid);
      }
    }, timeoutMs);

    let stdout = '';
    let stderr = '';

    if (proc.stdout) {
      proc.stdout.on('data', (chunk) => {
        if (stdout.length < maxOutputChars) {
          stdout += chunk.toString();
        }
      });
    }

    if (proc.stderr) {
      proc.stderr.on('data', (chunk) => {
        if (stderr.length < maxOutputChars) {
          stderr += chunk.toString();
        }
      });
    }

    proc.on('error', (err) => {
      clearTimeout(timer);
      activeChildProcesses.delete(proc);
      const durationMs = Date.now() - startTime;
      const errSummary = `Exit Code: 1\nOutput:\nSandbox process error: ${err.message}`;
      resolve({
        success: false,
        exitCode: 1,
        stdout: scrubTokens(stdout.substring(0, 5000)),
        stderr: scrubTokens((stderr + '\n' + err.message).substring(0, 5000)),
        passed: false,
        durationMs,
        timedOut,
        command: parsed.rawCommand,
        output: errSummary,
        toString() { return this.output; }
      });
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      activeChildProcesses.delete(proc);
      const durationMs = Date.now() - startTime;
      const exitCode = timedOut ? -1 : (code !== null ? code : 1);
      const passed = exitCode === 0 && !timedOut;

      const combinedOut = (stdout + (stderr ? ('\n' + stderr) : '')).substring(0, maxOutputChars);
      const scrubbed = scrubTokens(combinedOut);
      const outputText = `Exit Code: ${timedOut ? 'TIMED_OUT (-1)' : exitCode}\nOutput:\n${scrubbed}`;

      resolve({
        success: passed,
        exitCode,
        stdout: scrubTokens(stdout.substring(0, maxOutputChars)),
        stderr: scrubTokens(stderr.substring(0, maxOutputChars)),
        passed,
        durationMs,
        timedOut,
        command: parsed.rawCommand,
        output: outputText,
        toString() { return this.output; }
      });
    });
  });
}

module.exports = {
  executeInSandbox,
  validateWorkspacePath,
  buildSterileEnvironment,
  scrubTokens,
  terminateAllProcesses
};
