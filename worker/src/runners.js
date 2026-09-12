const path = require('path');
const fs = require('fs');

const ALLOWED_COMMANDS = [
  'npm test',
  'npm run build',
  'npm run lint',
  'npm install'
];

const FORBIDDEN_SHELL_CHARS = [';', '&', '|', '`', '$', '>', '<', '\n', '\r'];

/**
 * Polyglot Runner Definitions
 * Extensible map allowing future language runners (python, go, rust)
 * without altering core executor mechanics.
 */
const RUNNERS = {
  node: {
    name: 'node',
    matches(command) {
      return ALLOWED_COMMANDS.some(allowed => command === allowed || command.startsWith(allowed + ' '));
    },
    parse(command) {
      const parts = command.trim().split(/\s+/);
      const baseCmd = parts[0];
      const cmdArgs = parts.slice(1);

      let executable = baseCmd;
      let args = cmdArgs;

      // On Windows, handle npm safely without shell
      if (process.platform === 'win32' && baseCmd === 'npm') {
        const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
        try {
          fs.accessSync(npmCli);
          executable = process.execPath;
          args = [npmCli, ...cmdArgs];
        } catch (_) {
          executable = 'npm.cmd';
          args = cmdArgs;
        }
      }

      return { executable, args };
    }
  },

  python: {
    name: 'python',
    matches(command) {
      const allowed = ['pytest', 'python -m unittest', 'python3 -m unittest'];
      return allowed.some(a => command === a || command.startsWith(a + ' '));
    },
    parse(command) {
      const parts = command.trim().split(/\s+/);
      return { executable: parts[0], args: parts.slice(1) };
    }
  },

  go: {
    name: 'go',
    matches(command) {
      return command === 'go test' || command.startsWith('go test ');
    },
    parse(command) {
      const parts = command.trim().split(/\s+/);
      return { executable: 'go', args: parts.slice(1) };
    }
  },

  rust: {
    name: 'rust',
    matches(command) {
      return command === 'cargo test' || command.startsWith('cargo test ');
    },
    parse(command) {
      const parts = command.trim().split(/\s+/);
      return { executable: 'cargo', args: parts.slice(1) };
    }
  }
};

/**
 * Validates command against shell metacharacters and whitelist,
 * returning parsed executable and arguments for safe child_process.spawn(..., { shell: false }).
 */
function validateAndParseCommand(command) {
  if (!command || typeof command !== 'string') {
    throw new Error('Invalid command provided to worker');
  }

  const trimmed = command.trim();

  // 1. Rejection of shell metacharacters
  for (const char of FORBIDDEN_SHELL_CHARS) {
    if (trimmed.includes(char)) {
      throw new Error(`Worker validation error: Shell metacharacter '${char}' is forbidden`);
    }
  }

  // 2. Find matching runner
  for (const runnerKey of Object.keys(RUNNERS)) {
    const runner = RUNNERS[runnerKey];
    if (runner.matches(trimmed)) {
      const parsed = runner.parse(trimmed);
      return {
        runner: runner.name,
        executable: parsed.executable,
        args: parsed.args,
        rawCommand: trimmed
      };
    }
  }

  throw new Error('Command not allowed. Permitted operations: ' + ALLOWED_COMMANDS.join(', '));
}

module.exports = {
  validateAndParseCommand,
  ALLOWED_COMMANDS,
  FORBIDDEN_SHELL_CHARS,
  RUNNERS
};
