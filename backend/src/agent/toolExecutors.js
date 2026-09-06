const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const { runInSandbox } = require('../services/sandboxService');

const MAX_READ_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_READ_OUTPUT_CHARS = 30000;    // 30KB
const MAX_SEARCH_OUTPUT_CHARS = 15000;  // 15KB
const MAX_DIFF_OUTPUT_CHARS = 20000;    // 20KB
const MAX_PATCH_FILE_SIZE = 500 * 1024; // 500KB
const MAX_PATCH_TEXT_SIZE = 50 * 1024;  // 50KB

/**
 * Validate and safely resolve relative workspace paths.
 * Enforces directory containment and blocks directory traversal and sensitive files.
 */
function safeResolve(workspaceRoot, targetPath) {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('Target path must be a non-empty string');
  }

  // Null byte injection guard
  if (targetPath.includes('\0')) {
    throw new Error('Path traversal detected');
  }

  const resolvedRoot = path.resolve(workspaceRoot);
  const resolved = path.resolve(workspaceRoot, targetPath);
  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  
  if (resolved !== resolvedRoot && !resolved.startsWith(rootWithSep)) {
    throw new Error('Path traversal detected');
  }
  
  // Reject sensitive paths and credentials
  const lowerPath = resolved.toLowerCase().replace(/\\/g, '/');
  const baseName = path.basename(lowerPath);

  if (baseName.startsWith('.env') || 
      baseName.endsWith('.pem') || 
      baseName.endsWith('.key') || 
      baseName.endsWith('.pfx') || 
      baseName.endsWith('.p12') || 
      baseName.startsWith('id_rsa') || 
      baseName.includes('secret') || 
      baseName.includes('credential') || 
      baseName.includes('cred') || 
      baseName.includes('serviceaccount') || 
      baseName.includes('token') ||
      baseName === 'package-lock.json') {
    throw new Error('Access to sensitive or restricted files is forbidden');
  }

  const pathParts = lowerPath.split('/');
  for (const part of pathParts) {
    if (part === '.git' || 
        part === 'node_modules' || 
        part === '.ssh' || 
        part === 'secrets' || 
        part === 'credentials' || 
        part === '.aws' || 
        part === '.kube') {
      throw new Error('Access to sensitive or restricted files is forbidden');
    }
  }
  
  return resolved;
}

/**
 * Redact secrets, tokens, API keys, and connection URIs from strings.
 */
function scrubTokens(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/(gh[pousr]_[a-zA-Z0-9_]{20,80}|github_pat_[a-zA-Z0-9_]{20,100})/gi, '[REDACTED_GITHUB_TOKEN]')
    .replace(/(sk-or-v1-[a-zA-Z0-9_-]{16,80}|sk-[a-zA-Z0-9_-]{16,80})/gi, '[REDACTED_API_KEY]')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, '[REDACTED_MONGODB_URI]');
}

/**
 * Execute an agent tool within strict workspace and security boundaries.
 * Returns structured string results with sensitive data scrubbed.
 */
async function executeTool(name, args = {}, workspaceRoot) {
  try {
    if (!name || typeof name !== 'string') {
      throw new Error('Tool name must be a non-empty string');
    }

    switch (name) {
      case 'read_file': {
        if (!args.path || typeof args.path !== 'string') {
          throw new Error('read_file requires a valid "path" string parameter');
        }
        const filePath = safeResolve(workspaceRoot, args.path);
        
        let stats;
        try {
          stats = await fs.stat(filePath);
        } catch (e) {
          throw new Error(`File not found: ${args.path}`);
        }
        
        if (stats.isDirectory()) {
          throw new Error(`Cannot read directory "${args.path}". Use list_files instead.`);
        }
        if (stats.size > MAX_READ_FILE_SIZE) {
          throw new Error(`File too large to read (max ${MAX_READ_FILE_SIZE / 1024 / 1024}MB)`);
        }

        let content = await fs.readFile(filePath, 'utf8');
        if (content.length > MAX_READ_OUTPUT_CHARS) {
          content = content.substring(0, MAX_READ_OUTPUT_CHARS) + `\n... [Output truncated. Total size: ${content.length} bytes]`;
        }
        return scrubTokens(content);
      }
      
      case 'list_files': {
        const target = (args.path && typeof args.path === 'string') ? args.path : '.';
        const dirPath = safeResolve(workspaceRoot, target);
        
        let stats;
        try {
          stats = await fs.stat(dirPath);
        } catch (e) {
          throw new Error(`Directory not found: ${target}`);
        }
        if (!stats.isDirectory()) {
          throw new Error(`Path "${target}" is not a directory.`);
        }

        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const visibleEntries = entries
          .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
          .slice(0, 100)
          .map(e => `${e.isDirectory() ? '[DIR] ' : '      '}${e.name}`);

        return scrubTokens(visibleEntries.join('\n') || 'Empty directory');
      }
      
      case 'search_code': {
        if (!args.query || typeof args.query !== 'string' || !args.query.trim()) {
          throw new Error('search_code requires a non-empty "query" string parameter');
        }
        args.query = args.query.trim();
        if (args.query.length > 200) {
          throw new Error('Search query exceeds maximum length of 200 characters');
        }

        return await new Promise((resolve) => {
          const proc = spawn('git', ['grep', '-n', '--', args.query], { cwd: workspaceRoot, shell: false });
          let out = '';
          proc.stdout.on('data', d => {
            if (out.length < MAX_SEARCH_OUTPUT_CHARS) out += d;
          });
          proc.stderr.on('data', () => {});
          proc.on('close', () => {
            if (!out) return resolve('No matches found.');
            if (out.length >= MAX_SEARCH_OUTPUT_CHARS) {
              out = out.substring(0, MAX_SEARCH_OUTPUT_CHARS) + '\n... [Search output truncated]';
            }
            resolve(scrubTokens(out));
          });
        });
      }
      
      case 'apply_patch': {
        if (!args.path || typeof args.path !== 'string') {
          throw new Error('apply_patch requires a valid "path" string parameter');
        }
        if (typeof args.oldText !== 'string' || args.oldText.length === 0) {
          throw new Error('apply_patch requires a non-empty "oldText" parameter');
        }
        if (typeof args.newText !== 'string') {
          throw new Error('apply_patch requires a valid "newText" string parameter');
        }
        if (args.oldText.length > MAX_PATCH_TEXT_SIZE || args.newText.length > MAX_PATCH_TEXT_SIZE) {
          throw new Error(`Patch text exceeds maximum allowed size (${MAX_PATCH_TEXT_SIZE / 1024}KB)`);
        }

        const filePath = safeResolve(workspaceRoot, args.path);
        let stats;
        try {
          stats = await fs.stat(filePath);
        } catch (e) {
          throw new Error(`Cannot patch non-existent file: ${args.path}. Use create_file to create new files.`);
        }
        if (stats.isDirectory()) {
          throw new Error(`Cannot patch directory: ${args.path}`);
        }
        if (stats.size > MAX_PATCH_FILE_SIZE) {
          throw new Error(`File too large to patch (max ${MAX_PATCH_FILE_SIZE / 1024}KB)`);
        }

        let content = await fs.readFile(filePath, 'utf8');
        if (!content.includes(args.oldText)) {
          throw new Error('oldText not found in file. Patch failed. Please read the file again to ensure exact text matching.');
        }

        // Check for ambiguous multiple occurrences
        const occurrences = content.split(args.oldText).length - 1;
        if (occurrences > 1) {
          throw new Error(`oldText matches ${occurrences} locations in ${args.path}. Please provide more surrounding lines to make the patch location unique.`);
        }

        content = content.replace(args.oldText, args.newText);
        await fs.writeFile(filePath, content, 'utf8');
        return `Successfully patched ${args.path}`;
      }
      
      case 'create_file': {
        if (!args.path || typeof args.path !== 'string') {
          throw new Error('create_file requires a valid "path" string parameter');
        }
        if (typeof args.content !== 'string') {
          throw new Error('create_file requires a "content" string parameter');
        }
        if (args.content.length > MAX_READ_FILE_SIZE) {
          throw new Error(`File content exceeds maximum creation limit (${MAX_READ_FILE_SIZE / 1024 / 1024}MB)`);
        }

        const filePath = safeResolve(workspaceRoot, args.path);
        try {
          await fs.access(filePath);
          throw new Error('File already exists. Use apply_patch instead.');
        } catch (e) {
          if (e.message.includes('File already exists')) throw e;
          // Target does not exist, safe to create
        }
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, args.content, 'utf8');
        return `Successfully created ${args.path}`;
      }
      
      case 'run_validation': {
        const timeoutMs = args.timeoutMs || 60000;
        return await runInSandbox(args.command, workspaceRoot, { timeoutMs });
      }
      
      case 'git_diff': {
        return await new Promise((resolve) => {
          const proc = spawn('git', ['diff', 'HEAD'], { cwd: workspaceRoot, shell: false });
          let out = '';
          proc.stdout.on('data', d => {
            if (out.length < MAX_DIFF_OUTPUT_CHARS) out += d;
          });
          proc.stderr.on('data', () => {});
          proc.on('close', () => {
            if (!out) return resolve('No changes.');
            if (out.length >= MAX_DIFF_OUTPUT_CHARS) {
              out = out.substring(0, MAX_DIFF_OUTPUT_CHARS) + '\n... [Diff truncated]';
            }
            resolve(scrubTokens(out));
          });
        });
      }
      
      case 'complete_step': {
        return 'Step marked as complete.';
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return scrubTokens(`Error: ${err.message}`);
  }
}

const TOOL_MUTABILITY = {
  READ_ONLY: 'READ_ONLY',
  MUTATING: 'MUTATING',
  read_file: 'READ_ONLY',
  list_files: 'READ_ONLY',
  search_code: 'READ_ONLY',
  git_diff: 'READ_ONLY',
  complete_step: 'READ_ONLY',
  apply_patch: 'MUTATING',
  create_file: 'MUTATING',
  write_file: 'MUTATING',
  run_validation: 'MUTATING'
};

function getToolMutability(toolName) {
  return TOOL_MUTABILITY[toolName] || 'MUTATING';
}

function sanitizeToolArguments(args = {}) {
  const sanitized = {};
  const sensitiveKeyPatterns = [/token/i, /password/i, /secret/i, /key/i, /auth/i, /cookie/i, /credential/i];

  for (const [k, v] of Object.entries(args)) {
    if (sensitiveKeyPatterns.some(p => p.test(k))) {
      sanitized[k] = '[REDACTED]';
    } else if (k === 'path' || k === 'command') {
      sanitized[k] = typeof v === 'string' ? scrubTokens(v) : v;
    } else if (k === 'old_str' || k === 'new_str' || k === 'content') {
      sanitized[k] = typeof v === 'string'
        ? `[Length: ${v.length} chars, Preview: ${scrubTokens(v.substring(0, 60)).replace(/[\r\n]+/g, ' ')}...]`
        : '[Object]';
    } else if (typeof v === 'string') {
      sanitized[k] = scrubTokens(v).substring(0, 100);
    } else {
      sanitized[k] = v;
    }
  }
  sanitized.argumentKeys = Object.keys(args);
  return sanitized;
}

module.exports = {
  executeTool,
  scrubTokens,
  safeResolve,
  TOOL_MUTABILITY,
  getToolMutability,
  sanitizeToolArguments
};
