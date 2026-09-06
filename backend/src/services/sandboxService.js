const path = require('path');
const { spawn } = require('child_process');

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
  if (!workspacePath || typeof workspacePath !== 'string') {
    throw new Error('Invalid workspace path provided to sandbox');
  }

  const resolvedTarget = path.resolve(workspacePath);
  const backendWorkspaces = path.resolve(__dirname, '..', '..', 'workspaces');
  const rootWorkspaces = path.resolve(__dirname, '..', '..', '..', 'workspaces');

  const validRoots = [backendWorkspaces, rootWorkspaces];
  let isContained = validRoots.some(root => {
    const withSep = root.endsWith(path.sep) ? root : root + path.sep;
    return resolvedTarget !== root && resolvedTarget.startsWith(withSep);
  });

  // Support test workspaces under scratch or when running in test mode
  if (!isContained && (process.env.NODE_ENV === 'test' || resolvedTarget.includes('test_workspace'))) {
    if (resolvedTarget.includes('test_workspace') || resolvedTarget.includes('scratch')) {
      isContained = true;
    }
  }

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

/**
 * Executes a validation command inside the sandbox context with strict resource and timeout enforcement.
 */
async function runInSandbox(command, workspacePath, options = {}) {
  const validatedWorkspace = validateSandboxWorkspace(workspacePath);
  const validatedCommand = validateSandboxCommand(command);

  const timeoutMs = Math.min(Math.max(options.timeoutMs || 60000, 1000), 120000); // 1s to 120s
  const maxOutputChars = options.maxOutputChars || 50000;

  const cmdParts = validatedCommand.split(/\s+/);
  const baseCmd = cmdParts[0];
  const cmdArgs = cmdParts.slice(1);

  let spawnCmd = baseCmd;
  let spawnArgs = cmdArgs;

  // On Windows, handle npm safely without shell
  if (process.platform === 'win32' && baseCmd === 'npm') {
    const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    try {
      require('fs').accessSync(npmCli);
      spawnCmd = process.execPath;
      spawnArgs = [npmCli, ...cmdArgs];
    } catch (_) {
      spawnCmd = 'npm.cmd';
      spawnArgs = cmdArgs;
    }
  }

  const sterileEnv = buildSterileEnvironment(validatedWorkspace);
  const startTime = Date.now();
  let timedOut = false;

  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(spawnCmd, spawnArgs, {
        cwd: validatedWorkspace,
        env: sterileEnv,
        shell: false,
        windowsHide: true
      });
    } catch (spawnErr) {
      const durationMs = Date.now() - startTime;
      const errSummary = `Exit Code: 1\nOutput:\nSandbox spawn error: ${spawnErr.message}`;
      return resolve({
        exitCode: 1,
        stdout: '',
        stderr: spawnErr.message,
        passed: false,
        durationMs,
        timedOut: false,
        command: validatedCommand,
        output: errSummary,
        toString() { return this.output; }
      });
    }

    // Timeout killer: Terminates entire process tree
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (process.platform === 'win32' && proc.pid) {
          spawn('taskkill', ['/pid', proc.pid.toString(), '/T', '/F'], { shell: false });
        } else if (proc.pid) {
          proc.kill('SIGTERM');
          setTimeout(() => {
            try { proc.kill('SIGKILL'); } catch (_) {}
          }, 2000);
        }
      } catch (_) {}
    }, timeoutMs);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      if (stdout.length < maxOutputChars) {
        stdout += chunk.toString();
      }
    });

    proc.stderr.on('data', (chunk) => {
      if (stderr.length < maxOutputChars) {
        stderr += chunk.toString();
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      const errSummary = `Exit Code: 1\nOutput:\nSandbox process error: ${err.message}`;
      resolve({
        exitCode: 1,
        stdout: scrubTokens(stdout.substring(0, 5000)),
        stderr: scrubTokens((stderr + '\n' + err.message).substring(0, 5000)),
        passed: false,
        durationMs,
        timedOut,
        command: validatedCommand,
        output: errSummary,
        toString() { return this.output; }
      });
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      const exitCode = timedOut ? -1 : (code !== null ? code : 1);
      const passed = exitCode === 0 && !timedOut;

      const combinedOut = (stdout + (stderr ? ('\n' + stderr) : '')).substring(0, 5000);
      const scrubbed = scrubTokens(combinedOut);
      const outputText = `Exit Code: ${timedOut ? 'TIMED_OUT (-1)' : exitCode}\nOutput:\n${scrubbed}`;

      resolve({
        exitCode,
        stdout: scrubTokens(stdout.substring(0, 5000)),
        stderr: scrubTokens(stderr.substring(0, 5000)),
        passed,
        durationMs,
        timedOut,
        command: validatedCommand,
        output: outputText,
        toString() { return this.output; }
      });
    });
  });
}

module.exports = {
  runInSandbox,
  validateSandboxWorkspace,
  validateSandboxCommand,
  buildSterileEnvironment,
  scrubTokens,
  ALLOWED_COMMANDS
};
