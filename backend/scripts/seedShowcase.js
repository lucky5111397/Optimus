/**
 * OPTIMUS — Deterministic Development-Only Showcase Seed Script
 *
 * Populates a coherent synthetic project state in MongoDB and on disk
 * to enable high-fidelity local rendering of core authenticated UI views:
 *   1. AST Codebase Explorer (Repository Workspace)
 *   2. AI Implementation Plan & Approval Gate (Task Detail)
 *   3. Live Execution Terminal & Unified Diff (Task Detail)
 *   4. Engineering Dashboard, Reports, and Analytics
 *
 * SAFETY INVARIANTS:
 * - Forbidden in production environments (explicit NODE_ENV guard).
 * - Uses 100% synthetic, fictional project data (no real credentials, tokens, or URLs).
 * - Idempotent: safely upserts deterministic fixture IDs.
 * - Does not alter production authentication logic or execute arbitrary commands.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const jwt = require('jsonwebtoken');

// 0. Production Safety Check
if (process.env.NODE_ENV === 'production') {
  console.error('[SECURITY ERROR] Showcase seed script cannot be run in production.');
  process.exit(1);
}

// Models
const User = require('../src/models/User');
const Repository = require('../src/models/Repository');
const RepositoryBranch = require('../src/models/RepositoryBranch');
const Task = require('../src/models/Task');
const TaskPlan = require('../src/models/TaskPlan');
const Execution = require('../src/models/Execution');
const ExecutionEvent = require('../src/models/ExecutionEvent');
const UserSettings = require('../src/models/UserSettings');

// Deterministic Identifiers
const SHOWCASE_USER_ID = new mongoose.Types.ObjectId('65a000000000000000000001');
const SHOWCASE_REPO_ID = new mongoose.Types.ObjectId('65a000000000000000000002');
const TASK_COMPLETED_ID = new mongoose.Types.ObjectId('65a000000000000000000010');
const TASK_PLAN_READY_ID = new mongoose.Types.ObjectId('65a000000000000000000020');
const TASK_RUNNING_ID = new mongoose.Types.ObjectId('65a000000000000000000030');

const WORKSPACES_DIR = path.resolve(__dirname, '..', 'workspaces');
const SHOWCASE_WORKSPACE_DIR = path.resolve(WORKSPACES_DIR, SHOWCASE_REPO_ID.toString());

// Sample Source Code Fixtures for Workspace on Disk
const SAMPLE_SESSION_MANAGER_TS = `/**
 * Sentinel Auth Service — Session Manager
 * Handles refresh session issuance, rotation families, and replay detection.
 */

import { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';

export interface RefreshSessionPayload {
  userId: string;
  familyId: string;
  generation: number;
  jti: string;
}

export interface SessionPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class SessionManager {
  private redis: Redis;
  private secret: string;

  constructor(redis: Redis, secret: string) {
    this.redis = redis;
    this.secret = secret;
  }

  /**
   * Rotates a refresh session, issuing a new child session in the lineage.
   * If session reuse is detected, revokes the entire session family.
   */
  async rotateRefreshSession(oldSession: string): Promise<SessionPair> {
    const decoded = jwt.verify(oldSession, this.secret) as RefreshSessionPayload;
    const { userId, familyId, generation, jti } = decoded;

    // Check for replay attack: has this session already been consumed?
    const isRevoked = await this.redis.sismember(\`session:revoked:\${familyId}\`, jti);
    if (isRevoked) {
      // Invalidate the entire session family immediately
      await this.revokeSessionFamily(familyId, userId);
      throw new Error('Refresh session reuse detected. Revoking entire session family.');
    }

    // Mark current session as consumed with 7-day TTL
    await this.redis.sadd(\`session:revoked:\${familyId}\`, jti);
    await this.redis.expire(\`session:revoked:\${familyId}\`, 7 * 86400);

    // Issue rotated session pair
    return this.generateSessions(userId, familyId, generation + 1);
  }

  async revokeSessionFamily(familyId: string, userId: string): Promise<void> {
    await this.redis.set(\`family:revoked:\${familyId}\`, 'true', 'EX', 30 * 86400);
    await this.redis.publish('auth:events', JSON.stringify({ type: 'FAMILY_REVOKED', userId, familyId }));
  }

  async generateSessions(userId: string, familyId?: string, generation: number = 0): Promise<SessionPair> {
    const fid = familyId || crypto.randomUUID();
    const jti = crypto.randomUUID();

    const accessToken = jwt.sign({ userId, fid }, this.secret, { expiresIn: '15m' });
    const refreshToken = jwt.sign(
      { userId, familyId: fid, generation, jti },
      this.secret,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken, expiresIn: 900 };
  }
}
`;

const SAMPLE_REDIS_CLIENT_TS = `/**
 * Sentinel Auth Service — Redis Client
 * Provides connection pooling, automatic failover, and retry policies.
 */

import Redis from 'ioredis';

export function createRedisClient(connectionUri: string): Redis {
  const client = new Redis(connectionUri, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    autoResendUnfulfilledCommands: false,
    retryStrategy(times: number) {
      return Math.min(times * 100, 3000);
    }
  });

  client.on('error', (err) => {
    console.error('[Redis Client Error]', err.message);
  });

  return client;
}
`;

const SAMPLE_AUTH_TEST_TS = `import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenManager } from '../src/services/token.manager';

describe('TokenManager Rotation & Replay Protection', () => {
  let tokenManager: TokenManager;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      sismember: vi.fn().mockResolvedValue(0),
      sadd: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      set: vi.fn().mockResolvedValue('OK'),
      publish: vi.fn().mockResolvedValue(1)
    };
    tokenManager = new TokenManager(mockRedis, 'test-secret-key');
  });

  it('rotates refresh token and increments generation count', async () => {
    const initial = await tokenManager.generateTokens('usr-100');
    const rotated = await tokenManager.rotateRefreshToken(initial.refreshToken);

    expect(rotated.refreshToken).toBeDefined();
    expect(rotated.accessToken).toBeDefined();
    expect(mockRedis.sadd).toHaveBeenCalled();
  });

  it('detects replay attack and revokes token family on reuse', async () => {
    mockRedis.sismember.mockResolvedValueOnce(1); // token was previously consumed
    const initial = await tokenManager.generateTokens('usr-100');

    await expect(
      tokenManager.rotateRefreshToken(initial.refreshToken)
    ).rejects.toThrow('Refresh token reuse detected');

    expect(mockRedis.set).toHaveBeenCalled();
  });
});
`;

const SAMPLE_README_MD = `# Sentinel Auth Service

High-throughput distributed authentication and session microservice.

## Architecture Highlights
- **Stateless Access Tokens**: 15-minute RS256 signed JSON Web Tokens.
- **Sliding-Window Refresh Rotation**: Single-use token family lineage.
- **Atomic Replay Detection**: Redis set-backed consumed token invalidation.
- **Distributed Rate Limiting**: Per-IP sliding window counters.
`;

const SAMPLE_PACKAGE_JSON = JSON.stringify({
  name: 'sentinel-auth-service',
  version: '2.4.0',
  scripts: {
    test: 'vitest run',
    lint: 'eslint src/',
    build: 'tsc'
  },
  dependencies: {
    express: '^5.0.0',
    ioredis: '^5.4.1',
    jsonwebtoken: '^9.0.2',
    zod: '^3.23.8'
  },
  devDependencies: {
    vitest: '^1.6.0',
    typescript: '^5.4.5'
  }
}, null, 2);

const SAMPLE_GIT_DIFF = `diff --git a/src/services/session.manager.ts b/src/services/session.manager.ts
index 4a12b89..8f391c0 100644
--- a/src/services/session.manager.ts
+++ b/src/services/session.manager.ts
@@ -28,15 +28,42 @@ export class SessionManager {
-  async rotateRefreshSession(oldSession: string): Promise<SessionPair> {
-    const decoded = jwt.verify(oldSession, this.secret) as { userId: string };
-    return this.generateSessions(decoded.userId);
-  }
+  async rotateRefreshSession(oldSession: string): Promise<SessionPair> {
+    const decoded = jwt.verify(oldSession, this.secret) as RefreshSessionPayload;
+    const { userId, familyId, generation, jti } = decoded;
+
+    // Check for replay attack: has this session already been consumed?
+    const isRevoked = await this.redis.sismember(\`session:revoked:\${familyId}\`, jti);
+    if (isRevoked) {
+      // Invalidate the entire session family immediately
+      await this.revokeSessionFamily(familyId, userId);
+      throw new Error('Refresh session reuse detected. Revoking entire session family.');
+    }
+
+    // Mark current session as consumed with 7-day TTL
+    await this.redis.sadd(\`session:revoked:\${familyId}\`, jti);
+    await this.redis.expire(\`session:revoked:\${familyId}\`, 7 * 86400);
+
+    // Issue rotated session pair
+    return this.generateSessions(userId, familyId, generation + 1);
+  }
+
+  async revokeSessionFamily(familyId: string, userId: string): Promise<void> {
+    await this.redis.set(\`family:revoked:\${familyId}\`, 'true', 'EX', 30 * 86400);
+    await this.redis.publish('auth:events', JSON.stringify({ type: 'FAMILY_REVOKED', userId, familyId }));
+  }
diff --git a/src/services/redis.client.ts b/src/services/redis.client.ts
new file mode 100644
index 0000000..3c88a10
--- /dev/null
+++ b/src/services/redis.client.ts
@@ -0,0 +1,24 @@
+import Redis from 'ioredis';
+
+export function createRedisClient(connectionUri: string): Redis {
+  const client = new Redis(connectionUri, {
+    maxRetriesPerRequest: 3,
+    enableReadyCheck: true
+  });
+  return client;
+}
`;

async function seed() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/optimus';
  console.log(`[Showcase Seed] Connecting to MongoDB: ${mongoUri}...`);

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log('[Showcase Seed] Connected successfully.');

  // 1. Clean previous showcase entries (idempotent purge)
  await Promise.all([
    User.deleteOne({ _id: SHOWCASE_USER_ID }),
    Repository.deleteOne({ _id: SHOWCASE_REPO_ID }),
    RepositoryBranch.deleteMany({ repositoryId: SHOWCASE_REPO_ID }),
    Task.deleteMany({ _id: { $in: [TASK_COMPLETED_ID, TASK_PLAN_READY_ID, TASK_RUNNING_ID] } }),
    TaskPlan.deleteMany({ taskId: { $in: [TASK_COMPLETED_ID, TASK_PLAN_READY_ID, TASK_RUNNING_ID] } }),
    Execution.deleteMany({ taskId: { $in: [TASK_COMPLETED_ID, TASK_PLAN_READY_ID, TASK_RUNNING_ID] } }),
    ExecutionEvent.deleteMany({ taskId: { $in: [TASK_COMPLETED_ID, TASK_PLAN_READY_ID, TASK_RUNNING_ID] } }),
    UserSettings.deleteOne({ userId: SHOWCASE_USER_ID })
  ]);

  // 2. Insert Showcase User
  const showcaseUser = await User.create({
    _id: SHOWCASE_USER_ID,
    username: 'alex-chen',
    name: 'Alex Chen',
    email: 'alex.chen@optimus.local',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'Senior Systems Architect',
    primaryLanguage: 'JavaScript / TypeScript',
    provider: 'local_showcase',
    githubUsername: 'alexchen-dev',
    accessToken: 'demo_synthetic_token_only'
  });
  console.log(`[Showcase Seed] User created: ${showcaseUser.username} (${showcaseUser._id})`);

  // 3. Insert Showcase Repository
  const showcaseRepo = await Repository.create({
    _id: SHOWCASE_REPO_ID,
    userId: SHOWCASE_USER_ID,
    provider: 'github',
    owner: 'optimus-platform',
    name: 'sentinel-auth-service',
    status: 'READY',
    defaultBranch: 'main',
    url: 'https://github.com/optimus-platform/sentinel-auth-service',
    description: 'High-throughput authentication microservice with JWT rotation, distributed token blocklist, and rate limiting.'
  });
  console.log(`[Showcase Seed] Repository created: ${showcaseRepo.owner}/${showcaseRepo.name}`);

  // 4. Create Workspace on Disk for Codebase Explorer and Real Diff Inspection
  const { spawnSync } = require('child_process');
  await fs.mkdir(path.join(SHOWCASE_WORKSPACE_DIR, 'src', 'services'), { recursive: true });
  await fs.mkdir(path.join(SHOWCASE_WORKSPACE_DIR, 'src', 'middleware'), { recursive: true });
  await fs.mkdir(path.join(SHOWCASE_WORKSPACE_DIR, 'test'), { recursive: true });

  await fs.writeFile(path.join(SHOWCASE_WORKSPACE_DIR, 'README.md'), SAMPLE_README_MD, 'utf8');
  await fs.writeFile(path.join(SHOWCASE_WORKSPACE_DIR, 'package.json'), SAMPLE_PACKAGE_JSON, 'utf8');

  // Baseline session manager before rotation improvements
  const BASELINE_SESSION_MANAGER = `import jwt from 'jsonwebtoken';

export class SessionManager {
  private secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  async rotateRefreshSession(oldSession: string): Promise<any> {
    const decoded = jwt.verify(oldSession, this.secret) as { userId: string };
    return { accessToken: 'token', refreshToken: 'refresh' };
  }
}
`;
  await fs.writeFile(path.join(SHOWCASE_WORKSPACE_DIR, 'src', 'services', 'session.manager.ts'), BASELINE_SESSION_MANAGER, 'utf8');

  // Git init and baseline commit
  spawnSync('git', ['init'], { cwd: SHOWCASE_WORKSPACE_DIR });
  spawnSync('git', ['config', 'user.name', 'Optimus Agent'], { cwd: SHOWCASE_WORKSPACE_DIR });
  spawnSync('git', ['config', 'user.email', 'agent@optimus.local'], { cwd: SHOWCASE_WORKSPACE_DIR });
  spawnSync('git', ['add', '.'], { cwd: SHOWCASE_WORKSPACE_DIR });
  spawnSync('git', ['commit', '-m', 'feat: initial auth baseline'], { cwd: SHOWCASE_WORKSPACE_DIR });

  // Now apply the agent modifications to produce real working tree diff
  await fs.writeFile(path.join(SHOWCASE_WORKSPACE_DIR, 'src', 'services', 'session.manager.ts'), SAMPLE_SESSION_MANAGER_TS, 'utf8');
  await fs.writeFile(path.join(SHOWCASE_WORKSPACE_DIR, 'src', 'services', 'redis.client.ts'), SAMPLE_REDIS_CLIENT_TS, 'utf8');
  await fs.writeFile(path.join(SHOWCASE_WORKSPACE_DIR, 'test', 'auth.test.ts'), SAMPLE_AUTH_TEST_TS, 'utf8');
  console.log(`[Showcase Seed] Workspace files and git repository initialized at: ${SHOWCASE_WORKSPACE_DIR}`);

  // 5. Insert Repository Branch with Full AST Symbol Index
  const fileTree = [
    {
      name: 'src',
      path: 'src',
      type: 'directory',
      children: [
        {
          name: 'services',
          path: 'src/services',
          type: 'directory',
          children: [
            { name: 'session.manager.ts', path: 'src/services/session.manager.ts', type: 'file', size: 2450 },
            { name: 'redis.client.ts', path: 'src/services/redis.client.ts', type: 'file', size: 680 }
          ]
        },
        {
          name: 'middleware',
          path: 'src/middleware',
          type: 'directory',
          children: [
            { name: 'jwt.verify.ts', path: 'src/middleware/jwt.verify.ts', type: 'file', size: 1240 }
          ]
        }
      ]
    },
    {
      name: 'test',
      path: 'test',
      type: 'directory',
      children: [
        { name: 'auth.test.ts', path: 'test/auth.test.ts', type: 'file', size: 1420 }
      ]
    },
    { name: 'package.json', path: 'package.json', type: 'file', size: 380 },
    { name: 'README.md', path: 'README.md', type: 'file', size: 450 }
  ];

  const symbols = [
    { name: 'SessionManager', type: 'class', file: 'src/services/session.manager.ts', line: 18 },
    { name: 'rotateRefreshSession', type: 'method', file: 'src/services/session.manager.ts', line: 36 },
    { name: 'revokeSessionFamily', type: 'method', file: 'src/services/session.manager.ts', line: 55 },
    { name: 'generateSessions', type: 'method', file: 'src/services/session.manager.ts', line: 60 },
    { name: 'createRedisClient', type: 'function', file: 'src/services/redis.client.ts', line: 3 },
    { name: 'verifyJwtToken', type: 'function', file: 'src/middleware/jwt.verify.ts', line: 12 }
  ];

  const dependencies = [
    { name: 'express', version: '^5.0.0', type: 'production' },
    { name: 'ioredis', version: '^5.4.1', type: 'production' },
    { name: 'jsonwebtoken', version: '^9.0.2', type: 'production' },
    { name: 'zod', version: '^3.23.8', type: 'production' },
    { name: 'vitest', version: '^1.6.0', type: 'development' }
  ];

  await RepositoryBranch.create({
    repositoryId: SHOWCASE_REPO_ID,
    name: 'main',
    commitSha: 'e8b4f2109c3a7d4e5f608192a3b4c5d6e7f8091a',
    isDefault: true,
    lastIndexed: new Date(),
    indexStatus: 'READY',
    fileIndex: {
      fileCount: 6,
      symbolCount: symbols.length,
      fileTree,
      files: fileTree,
      symbols,
      dependencies
    }
  });
  console.log('[Showcase Seed] Repository branch & AST symbols indexed.');

  // 6. Task 1: Verified / Completed Task with Live Terminal Logs & Git Diff
  const planMarkdown1 = `# Implementation Plan — Refresh Session Rotation & Replay Revocation

### Objective
Mitigate session replay vulnerabilities by implementing sliding-window refresh session rotation with atomic Redis-backed revocation lists.

### Approach
1. Issue single-use refresh session families identified by UUIDv4 lineage.
2. Invalidate consumed \`jti\` sessions in Redis with a 7-day sliding window.
3. Automatically revoke entire session families if a previously consumed session token is reused.
`;
  const planHash1 = crypto.createHash('sha256').update(planMarkdown1).digest('hex');

  const task1 = await Task.create({
    _id: TASK_COMPLETED_ID,
    repositoryId: SHOWCASE_REPO_ID,
    userId: SHOWCASE_USER_ID,
    title: 'Implement Sliding-Window Refresh Session Rotation with Redis Revocation List',
    description: 'Mitigate session reuse and replay vulnerabilities by issuing single-use refresh session families, tracking generation lineage in Redis with atomic TTLs, and invalidating entire families upon reuse detection.',
    status: 'VERIFIED',
    priority: 'HIGH',
    approvedPlanHash: planHash1,
    deliveryBranch: 'optimus/task-2041-session-rotation',
    deliveryStatus: 'READY'
  });

  await TaskPlan.create({
    taskId: TASK_COMPLETED_ID,
    summary: 'Implement single-use refresh session families with atomic Redis revocation.',
    approach: 'Track session generation lineage. On rotation, store consumed jti in Redis. Invalidate entire family on duplicate submission.',
    steps: [
      {
        title: 'Scaffold Redis connection client with retry strategy',
        description: 'Create src/services/redis.client.ts with exponential backoff.',
        filesAffected: ['src/services/redis.client.ts']
      },
      {
        title: 'Implement session rotation and replay invalidation logic',
        description: 'Update SessionManager with atomic family validation and Redis sadd operations.',
        filesAffected: ['src/services/session.manager.ts']
      },
      {
        title: 'Add comprehensive unit tests for rotation and replay detection',
        description: 'Write test/auth.test.ts covering standard rotation and simulated replay attacks.',
        filesAffected: ['test/auth.test.ts']
      }
    ],
    filesToInspect: ['src/services/session.manager.ts'],
    filesExpectedToChange: ['src/services/session.manager.ts', 'src/services/redis.client.ts', 'test/auth.test.ts'],
    assumptions: ['Redis 7.x instance accessible via connection string', 'Sessions signed with RS256 or HS256 algorithm'],
    risks: ['Network latency to Redis during session rotation'],
    validationStrategy: 'Run automated vitest test suite inside sterile worker sandbox.',
    markdown: planMarkdown1,
    planHash: planHash1,
    version: 1,
    generatedAt: new Date(Date.now() - 3600000),
    approvedAt: new Date(Date.now() - 3000000)
  });

  const executionLogs1 = [
    { timestamp: new Date(Date.now() - 120000), stream: 'system', text: 'Initializing isolated worker sandbox for Task #TK-2041...' },
    { timestamp: new Date(Date.now() - 118000), stream: 'system', text: 'Sandbox security verified: sterile container, network isolated, cap_drop ALL.' },
    { timestamp: new Date(Date.now() - 110000), stream: 'system', text: 'Step 1/3: Creating Redis client in src/services/redis.client.ts' },
    { timestamp: new Date(Date.now() - 95000), stream: 'stdout', text: 'Wrote 24 lines to src/services/redis.client.ts' },
    { timestamp: new Date(Date.now() - 90000), stream: 'system', text: 'Step 2/3: Refactoring SessionManager to track session generation lineage' },
    { timestamp: new Date(Date.now() - 75000), stream: 'stdout', text: 'Applied patch to src/services/session.manager.ts (+42 lines, -6 lines)' },
    { timestamp: new Date(Date.now() - 60000), stream: 'system', text: 'Step 3/3: Running validation suite inside container sandbox: npm test' },
    { timestamp: new Date(Date.now() - 45000), stream: 'stdout', text: 'PASS test/auth.test.ts' },
    { timestamp: new Date(Date.now() - 44000), stream: 'stdout', text: '  √ rotates refresh session and increments generation count (14ms)' },
    { timestamp: new Date(Date.now() - 43000), stream: 'stdout', text: '  √ detects replay attack and revokes session family on reuse (9ms)' },
    { timestamp: new Date(Date.now() - 40000), stream: 'stdout', text: '\nTest Suites: 1 passed, 1 total\nTests:       2 passed, 2 total\nSnapshots:   0 total\nTime:        1.24s' },
    { timestamp: new Date(Date.now() - 35000), stream: 'system', text: 'Automated test suite passed with exit code 0.' },
    { timestamp: new Date(Date.now() - 30000), stream: 'system', text: 'Computing unified git diff and generating SHA-256 verification hash.' },
    { timestamp: new Date(Date.now() - 25000), stream: 'system', text: 'Execution verified successfully. Ready for Pull Request delivery.' }
  ];

  await Execution.create({
    taskId: TASK_COMPLETED_ID,
    repositoryId: SHOWCASE_REPO_ID,
    userId: SHOWCASE_USER_ID,
    status: 'COMPLETED',
    currentStep: 3,
    totalSteps: 3,
    startedAt: new Date(Date.now() - 120000),
    completedAt: new Date(Date.now() - 25000),
    traceId: 'trace-opt-8f92a1',
    metadata: {
      model: 'anthropic/claude-3.5-sonnet',
      finalModel: 'anthropic/claude-3.5-sonnet',
      totalTurns: 5,
      sandboxed: true
    },
    executionLogs: executionLogs1,
    changedFiles: ['src/services/redis.client.ts', 'src/services/session.manager.ts', 'test/auth.test.ts'],
    validationResults: {
      status: 'PASSED',
      exitCode: 0,
      durationMs: 1240,
      testOutput: 'PASS test/auth.test.ts (2 tests passed)'
    },
    review: {
      ready: true,
      reasonsNotReady: [],
      totalAdditions: 42,
      totalDeletions: 6,
      diffStat: '2 files changed, 42 insertions(+), 6 deletions(-)',
      diff: SAMPLE_GIT_DIFF,
      validationResults: { status: 'PASSED', command: 'npm test', exitCode: 0 }
    }
  });

  // 7. Task 2: Plan Ready Task with Active Approval Gate
  const planMarkdown2 = `# Implementation Plan — Distributed Sliding-Window Rate Limiting

### Objective
Enforce per-IP and per-account request rate limits across authentication and token refresh endpoints using Redis sliding-window log algorithms.

### Approach
1. Implement sliding-window counter using Redis sorted sets (ZSET).
2. Intercept requests at \`/api/auth/*\` routes with Express middleware.
3. Return \`429 Too Many Requests\` with \`Retry-After\` and \`X-RateLimit-*\` headers when thresholds are exceeded.
4. Provide unit tests validating burst behavior and sliding-window expiration.
`;
  const planHash2 = crypto.createHash('sha256').update(planMarkdown2).digest('hex');

  await Task.create({
    _id: TASK_PLAN_READY_ID,
    repositoryId: SHOWCASE_REPO_ID,
    userId: SHOWCASE_USER_ID,
    title: 'Add Distributed Sliding-Window Rate Limiter Middleware for Auth Endpoints',
    description: 'Enforce per-IP and per-account request rate limits across authentication and token refresh endpoints using Redis sliding-window log algorithms.',
    status: 'PLAN_READY',
    priority: 'MEDIUM'
  });

  await TaskPlan.create({
    taskId: TASK_PLAN_READY_ID,
    summary: 'Add distributed sliding-window rate limiter middleware backed by Redis.',
    approach: 'Use Redis ZADD with millisecond timestamps to record request events, then ZREMRANGEBYSCORE to prune expired hits.',
    steps: [
      {
        title: 'Create sliding-window rate limiter middleware',
        description: 'Implement src/middleware/rate.limit.ts with configurable windowMs and maxRequests.',
        filesAffected: ['src/middleware/rate.limit.ts']
      },
      {
        title: 'Attach rate limiter to sensitive authentication endpoints',
        description: 'Mount middleware on /api/auth/login and /api/auth/token routes.',
        filesAffected: ['src/index.ts']
      },
      {
        title: 'Add unit tests verifying window boundaries and 429 status response',
        description: 'Simulate high request volumes and verify standard RFC-6585 rate limit headers.',
        filesAffected: ['test/rate.limit.test.ts']
      }
    ],
    filesToInspect: ['src/index.ts', 'src/middleware/jwt.verify.ts'],
    filesExpectedToChange: ['src/middleware/rate.limit.ts', 'src/index.ts', 'test/rate.limit.test.ts'],
    assumptions: ['Clocks across application nodes synchronized via NTP', 'Redis network latency under 5ms'],
    risks: ['High memory overhead if window sizes exceed 1 hour under DDoS'],
    validationStrategy: 'Execute vitest suite and verify header assertions.',
    markdown: planMarkdown2,
    planHash: planHash2,
    version: 1,
    generatedAt: new Date(Date.now() - 600000)
  });

  // 7b. Task 3: Running Agentic Execution Task
  const task3 = await Task.create({
    _id: TASK_RUNNING_ID,
    repositoryId: SHOWCASE_REPO_ID,
    userId: SHOWCASE_USER_ID,
    title: 'Implement Structured JSON Telemetry Logging with Correlation IDs',
    description: 'Replace unstructured console logging with structured JSON logs containing request correlation IDs, duration metrics, and ISO timestamps.',
    status: 'IMPLEMENTING',
    priority: 'MEDIUM'
  });

  const executionLogs3 = [
    { timestamp: new Date(Date.now() - 45000), stream: 'system', text: 'Initializing isolated worker sandbox for Task #TK-2043...' },
    { timestamp: new Date(Date.now() - 42000), stream: 'system', text: 'Spawning agent loop: anthropic/claude-3.5-sonnet (turn 1/25)...' },
    { timestamp: new Date(Date.now() - 38000), stream: 'system', text: 'Tool Call: read_file path="src/services/session.manager.ts"' },
    { timestamp: new Date(Date.now() - 34000), stream: 'stdout', text: 'Reading AST context: 124 lines, 3 classes, 8 methods indexed.' },
    { timestamp: new Date(Date.now() - 25000), stream: 'system', text: 'Tool Call: write_file path="src/utils/logger.ts"' },
    { timestamp: new Date(Date.now() - 20000), stream: 'stdout', text: 'Created structured JSON logger utility with correlation tracing.' },
    { timestamp: new Date(Date.now() - 15000), stream: 'system', text: 'Tool Call: run_command command="npm run test:lint"' },
    { timestamp: new Date(Date.now() - 10000), stream: 'stdout', text: 'ESLint: 0 errors, 0 warnings across modified files.' },
    { timestamp: new Date(Date.now() - 5000), stream: 'system', text: 'Executing step 2/4: Instrumenting middleware routes with correlation IDs...' }
  ];

  await Execution.create({
    taskId: TASK_RUNNING_ID,
    repositoryId: SHOWCASE_REPO_ID,
    userId: SHOWCASE_USER_ID,
    status: 'RUNNING',
    currentStep: 2,
    totalSteps: 4,
    startedAt: new Date(Date.now() - 45000),
    traceId: 'trace-opt-9b44c2',
    metadata: {
      model: 'anthropic/claude-3.5-sonnet',
      finalModel: 'anthropic/claude-3.5-sonnet',
      totalTurns: 3,
      sandboxed: true
    },
    executionLogs: executionLogs3,
    changedFiles: ['src/utils/logger.ts', 'src/middleware/correlation.ts']
  });

  // 8. User Settings
  await UserSettings.create({
    userId: SHOWCASE_USER_ID,
    envVars: [
      { key: 'REDIS_URL', value: 'redis://localhost:6379' },
      { key: 'NODE_ENV', value: 'development' }
    ],
    aiPreferences: {
      defaultModel: 'anthropic/claude-3.5-sonnet',
      maxTurns: 25,
      autonomyLevel: 'supervised'
    }
  });

  // 9. Generate Valid Development JWT Token
  const devToken = jwt.sign(
    { userId: SHOWCASE_USER_ID },
    process.env.JWT_SECRET || 'fallback_secret_dev_only',
    { expiresIn: '7d' }
  );

  console.log('\n================================================================');
  console.log(' OPTIMUS SHOWCASE DATA SEED COMPLETE');
  console.log('================================================================');
  console.log(`Demo User ID:       ${SHOWCASE_USER_ID}`);
  console.log(`Demo Repo ID:       ${SHOWCASE_REPO_ID}`);
  console.log(`Task 1 (Completed): ${TASK_COMPLETED_ID} (Live Terminal & Diff)`);
  console.log(`Task 2 (Plan Ready):${TASK_PLAN_READY_ID} (AI Plan & Approval Gate)`);
  console.log('----------------------------------------------------------------');
  console.log('URLS FOR PORTFOLIO SCREENSHOTS:');
  console.log(`  AST Codebase Explorer: http://localhost:5173/repositories/${SHOWCASE_REPO_ID}`);
  console.log(`  AI Plan Approval Gate: http://localhost:5173/repositories/${SHOWCASE_REPO_ID}`);
  console.log(`  Live Execution & Diff: http://localhost:5173/repositories/${SHOWCASE_REPO_ID}`);
  console.log(`  Engineering Report:    http://localhost:5173/report/${TASK_COMPLETED_ID}`);
  console.log(`  Dashboard:             http://localhost:5173/dashboard`);
  console.log(`  Analytics:             http://localhost:5173/analytics`);
  console.log('----------------------------------------------------------------');
  console.log('DEVELOPMENT AUTHENTICATION TOKEN (Valid for 7 days):');
  console.log(devToken);
  console.log('----------------------------------------------------------------');
  console.log('To authenticate in your local browser:');
  console.log('  Open DevTools -> Application -> Cookies -> http://localhost:3000');
  console.log(`  Add cookie: Name="token", Value="${devToken}"`);
  console.log('================================================================\n');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('[Showcase Seed Error]', err);
  process.exit(1);
});
