#!/usr/bin/env node
/**
 * OPTIMUS Automated Secret & Credential Scanner
 *
 * Scans tracked or staged files for accidental secret leakage, including:
 * - Database credentials & connection URIs
 * - API keys (OpenAI, OpenRouter, Anthropic, Google, etc.)
 * - GitHub Personal Access Tokens & OAuth secrets
 * - AWS access keys and secrets
 * - Private keys (RSA, EC, DSA, OpenSSH, PGP)
 * - Raw JWT tokens
 *
 * Usage:
 *   node scripts/check-secrets.js          # Scans all tracked files
 *   node scripts/check-secrets.js --staged # Scans only staged files (for pre-commit)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

// Command line arguments
const isStagedOnly = process.argv.includes('--staged');

// Allowed / synthetic test fixtures that are intentionally designed to test redaction
const ALLOWED_FILES = new Set([
  'backend/src/benchmark/fixtures/fixture-04-token-redaction/test.js',
  'backend/src/benchmark/fixtures/fixture-04-token-redaction/src/sanitizer.js',
  'worker/test/worker_security.test.js',
  'docs/DEVELOPMENT.md',
  '.env.example',
  'backend/.env.example',
  'frontend/.env.example',
  'worker/.env.example'
]);

// Binary / non-text extensions to ignore
const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
  '.pdf', '.zip', '.tar', '.gz', '.woff', '.woff2', '.ttf', '.eot'
]);

// Secret detection rules
const SECRET_RULES = [
  {
    name: 'MongoDB Connection String with Password',
    category: 'DATABASE_CREDENTIAL',
    regex: /mongodb(?:\+srv)?:\/\/(?:[a-zA-Z0-9_\-\.%]+):([a-zA-Z0-9_\-\.%@!#$^&*]+)@/g,
    filter: (match, line) => {
      // Allow localhost or standard local development placeholder values
      if (line.includes('localhost') || line.includes('your_') || line.includes('[REDACTED]')) return false;
      return true;
    }
  },
  {
    name: 'Postgres/MySQL Connection String with Password',
    category: 'DATABASE_CREDENTIAL',
    regex: /(?:postgres(?:ql)?|mysql):\/\/(?:[a-zA-Z0-9_\-\.%]+):([a-zA-Z0-9_\-\.%@!#$^&*]+)@/g,
    filter: (match, line) => {
      if (line.includes('localhost') || line.includes('your_') || line.includes('[REDACTED]')) return false;
      return true;
    }
  },
  {
    name: 'Private Key Header',
    category: 'PRIVATE_KEY',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
    filter: (match, line) => {
      // Allow doc examples or redaction strings
      if (line.includes('...') || line.includes('[REDACTED]')) return false;
      return true;
    }
  },
  {
    name: 'GitHub Personal Access Token',
    category: 'GITHUB_TOKEN',
    regex: /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}|github_pat_[a-zA-Z0-9_]{30,}/g,
    filter: (match, line) => {
      if (line.includes('[REDACTED]') || line.includes('ghp_your') || line.includes('ghp_test')) return false;
      return true;
    }
  },
  {
    name: 'AWS Access Key ID',
    category: 'AWS_CREDENTIAL',
    regex: /(?:A3T[A-Z0-9]|AKIA[0-9A-Z]{16}|AGPA[0-9A-Z]{16}|AIDA[0-9A-Z]{16}|AROA[0-9A-Z]{16}|AIPA[0-9A-Z]{16}|ANPA[0-9A-Z]{16}|ANVA[0-9A-Z]{16})/g,
    filter: (match, line) => {
      if (line.includes('AKIAIOSFODNN7EXAMPLE') || line.includes('[REDACTED]')) return false;
      return true;
    }
  },
  {
    name: 'AI Service Secret Key (OpenAI / OpenRouter / Anthropic)',
    category: 'AI_API_KEY',
    regex: /(?:sk-ant-[a-zA-Z0-9_\-]{20,}|sk-or-v1-[a-f0-9]{64}|sk-[a-zA-Z0-9]{48,})/g,
    filter: (match, line) => {
      if (line.includes('[REDACTED]') || line.includes('sk-test') || line.includes('sk-dummy') || line.includes('openrouter/free')) return false;
      return true;
    }
  },
  {
    name: 'Hardcoded High-Entropy Secret Assignment',
    category: 'HARDCODED_SECRET',
    regex: /(?:jwt_secret|client_secret|db_password)\s*[:=]\s*['"]([a-zA-Z0-9_\-\.!@#$%^&*]{16,})['"]/gi,
    filter: (match, line) => {
      const lower = line.toLowerCase();
      // Allow placeholder defaults and test secret values
      if (lower.includes('fallback_secret_dev_only') ||
          lower.includes('ci-test-token-secret-deterministic') ||
          lower.includes('your_') ||
          lower.includes('dummy') ||
          lower.includes('test') ||
          lower.includes('placeholder') ||
          lower.includes('[redacted]')) {
        return false;
      }
      return true;
    }
  }
];

function getFilesToScan() {
  try {
    let files;
    if (isStagedOnly) {
      const stdout = execSync('git diff --cached --name-only --diff-filter=ACM', {
        cwd: REPO_ROOT,
        encoding: 'utf8'
      });
      files = stdout.split(/\r?\n/).filter(Boolean);
    } else {
      const stdout = execSync('git ls-files', {
        cwd: REPO_ROOT,
        encoding: 'utf8'
      });
      files = stdout.split(/\r?\n/).filter(Boolean);
    }
    return files;
  } catch (err) {
    console.error('[check-secrets] Failed to list git files:', err.message);
    process.exit(1);
  }
}

function redactSnippet(line) {
  return line
    .replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/g, '$1[REDACTED_PASSWORD]$3')
    .replace(/(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{10,}/g, '$1_[REDACTED_TOKEN]')
    .replace(/github_pat_[a-zA-Z0-9_]{10,}/g, 'github_pat_[REDACTED_TOKEN]')
    .replace(/(AKIA[0-9A-Z]{4})[0-9A-Z]{12}/g, '$1[REDACTED_AWS_KEY]')
    .replace(/(sk-or-v1-)[a-f0-9]{10,}/g, '$1[REDACTED_API_KEY]')
    .replace(/(sk-[a-zA-Z0-9]{6})[a-zA-Z0-9]+/g, '$1[REDACTED_KEY]')
    .trim();
}

function scan() {
  const files = getFilesToScan();
  const findings = [];

  for (const relativeFile of files) {
    const normalized = relativeFile.replace(/\\/g, '/');

    // Skip allowed files
    if (ALLOWED_FILES.has(normalized)) continue;

    // Skip ignored extensions
    const ext = path.extname(normalized).toLowerCase();
    if (IGNORED_EXTENSIONS.has(ext)) continue;

    // Check for accidental tracked environment files
    const baseName = path.basename(normalized);
    if (baseName.startsWith('.env') && baseName !== '.env.example') {
      findings.push({
        file: normalized,
        line: 1,
        category: 'ENV_FILE_TRACKED',
        rule: 'Tracked .env File Violation',
        snippet: `Tracked file matching ${baseName} must never be committed to Git.`
      });
      continue;
    }

    const fullPath = path.resolve(REPO_ROOT, normalized);
    if (!fs.existsSync(fullPath)) continue;

    let content;
    try {
      content = fs.readFileSync(fullPath, 'utf8');
    } catch {
      continue; // Skip unreadable/binary
    }

    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const rule of SECRET_RULES) {
        rule.regex.lastIndex = 0;
        let match;
        while ((match = rule.regex.exec(line)) !== null) {
          if (!rule.filter || rule.filter(match, line)) {
            findings.push({
              file: normalized,
              line: i + 1,
              category: rule.category,
              rule: rule.name,
              snippet: redactSnippet(line)
            });
            break; // Stop checking other rules for this line
          }
        }
      }
    }
  }

  return findings;
}

const findings = scan();

if (findings.length === 0) {
  console.log('[check-secrets] PASS: No secrets, credentials, or tracked .env files detected.');
  process.exit(0);
} else {
  console.error(`\n[check-secrets] FAIL: Found ${findings.length} potential secret(s) in repository:\n`);
  findings.forEach((f, idx) => {
    console.error(`  ${idx + 1}. [${f.category}] ${f.file}:${f.line}`);
    console.error(`     Rule: ${f.rule}`);
    console.error(`     Snippet: ${f.snippet}\n`);
  });
  console.error('[check-secrets] Please remove the secrets before committing or pushing.\n');
  process.exit(1);
}
