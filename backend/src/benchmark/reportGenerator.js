/**
 * OPTIMUS — Phase 17 Report Generator
 *
 * Produces structured machine-readable (JSON) and human-readable (Markdown) reports
 * from benchmark execution data.
 *
 * Guarantees:
 * - Deterministic output formatting
 * - Token and credential scrubbing via scrubTokens()
 * - Path traversal prevention for file output
 * - Zero external npm dependencies
 */

const fs = require('fs');
const path = require('path');
const { scrubTokens } = require('../agent/toolExecutors');
const { calculateMetrics } = require('./metricsCalculator');

/**
 * Deeply scrubs credentials, secrets, tokens, and URIs from arbitrary values.
 */
function deepScrub(val) {
  if (typeof val === 'string') {
    return scrubTokens(val);
  }
  if (Array.isArray(val)) {
    return val.map(deepScrub);
  }
  if (val !== null && typeof val === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(val)) {
      // Exclude or mask known sensitive keys
      if (/password|secret|apikey|token|auth|cookie|credential|privatekey/i.test(k)) {
        clean[k] = '[REDACTED]';
      } else {
        clean[k] = deepScrub(v);
      }
    }
    return clean;
  }
  return val;
}

/**
 * Normalizes and validates safe benchmark run identifiers.
 */
function sanitizeRunId(runId) {
  if (typeof runId !== 'string' || !runId.trim()) {
    return `bench_run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
  const clean = runId.trim().replace(/[^a-zA-Z0-9_.-]/g, '_');
  return clean.substring(0, 80);
}

/**
 * Generates the standardized machine-readable benchmark JSON report.
 *
 * @param {Object} benchmarkData - Raw benchmark execution data
 * @returns {Object} Cleaned, structured JSON report
 */
function generateJsonReport(benchmarkData = {}) {
  const safeData = benchmarkData || {};
  const runId = sanitizeRunId(safeData.benchmarkRunId || safeData.runId);
  const timestamp = safeData.timestamp || new Date().toISOString();

  const environment = {
    nodeVersion: process.version,
    platform: process.platform,
    executionMode: safeData.environment?.executionMode || safeData.executionMode || 'live',
    model: safeData.environment?.model || safeData.model || 'OpenRouter / Free Tier',
    ...(safeData.environment ? deepScrub(safeData.environment) : {})
  };

  const rawScenarios = Array.isArray(safeData.scenarios) ? safeData.scenarios : [];
  const metrics = safeData.metrics || calculateMetrics(rawScenarios);

  const cleanScenarios = rawScenarios.map(s => {
    if (!s) return {};
    const fixtureId = String(s.fixtureId || s.id || 'unknown');
    const title = String(s.title || fixtureId);
    const category = String(s.category || 'BUG_FIX');
    const status = String(s.status || (s.verified ? 'VERIFIED' : 'FAILED')).toUpperCase();
    const durationMs = typeof s.durationMs === 'number' ? s.durationMs : (s.duration || 0);
    const validationAttempts = typeof s.validationAttempts === 'number' ? s.validationAttempts : 1;
    const recovered = s.recovered === true;
    const changedFiles = Array.isArray(s.changedFiles) ? s.changedFiles.map(f => deepScrub(String(f))) : [];
    const expectedFiles = Array.isArray(s.expectedChangedFiles) ? s.expectedChangedFiles : (Array.isArray(s.expectedFiles) ? s.expectedFiles : []);

    const tokens = s.tokens || s.metadata?.usage || {};
    const promptTokens = tokens.promptTokens || tokens.inputTokens || 0;
    const completionTokens = tokens.completionTokens || tokens.outputTokens || 0;
    const totalTokens = tokens.totalTokens || (promptTokens + completionTokens);

    return {
      fixtureId: deepScrub(fixtureId),
      title: deepScrub(title),
      category: deepScrub(category),
      status,
      durationMs,
      baseline: deepScrub(s.baseline || { exitCode: 1, passed: false }),
      postExecution: deepScrub(s.postExecution || { exitCode: status === 'VERIFIED' ? 0 : 1, passed: status === 'VERIFIED' }),
      validationAttempts,
      recovered,
      changedFiles,
      expectedFiles: expectedFiles.map(f => deepScrub(String(f))),
      diffPrecision: typeof s.diffPrecision === 'number' ? s.diffPrecision : (changedFiles.length > 0 ? 100.0 : 0.0),
      tokens: {
        promptTokens,
        completionTokens,
        totalTokens
      },
      diff: deepScrub(s.diff || s.diffPreview || ''),
      auditEventsCount: typeof s.auditEventsCount === 'number' ? s.auditEventsCount : (s.auditEvents?.length || 0),
      error: s.error ? deepScrub(String(s.error)) : null
    };
  });

  const totalAuditEvents = typeof safeData.auditEventCount === 'number'
    ? safeData.auditEventCount
    : cleanScenarios.reduce((sum, s) => sum + (s.auditEventsCount || 0), 0);

  let combinedDiffPreview = safeData.diffPreview || '';
  if (!combinedDiffPreview && cleanScenarios.length > 0) {
    combinedDiffPreview = cleanScenarios
      .filter(s => s.diff)
      .map(s => `# --- ${s.fixtureId} ---\\n${s.diff}`)
      .join('\\n\\n');
  }

  const tokenCounts = {
    promptTokens: metrics.tokens?.promptTokens || 0,
    completionTokens: metrics.tokens?.completionTokens || 0,
    totalTokens: metrics.tokens?.totalTokens || 0,
    formattedTotalTokens: (metrics.tokens?.totalTokens || 0).toLocaleString(),
    estimatedCost: metrics.tokens?.estimatedCost || 'Unavailable / Free Tier'
  };

  return {
    benchmarkRunId: runId,
    timestamp,
    environment,
    summary: {
      status: metrics.summary?.status || (metrics.summary?.overallPassed ? 'PASSED' : 'FAILED'),
      overallPassed: metrics.summary?.overallPassed || false,
      totalTasks: metrics.summary?.totalTasks || cleanScenarios.length,
      passedTasks: metrics.summary?.passedTasks || 0,
      failedTasks: metrics.summary?.failedTasks || 0
    },
    metrics,
    tokenCounts,
    scenarios: cleanScenarios,
    diffPreview: deepScrub(combinedDiffPreview),
    auditEventCount: totalAuditEvents
  };
}

/**
 * Generates human-readable Markdown summary report.
 *
 * @param {Object} benchmarkData - Raw or normalized benchmark data
 * @returns {string} GitHub-Flavored Markdown report content
 */
function generateMarkdownReport(benchmarkData = {}) {
  const report = generateJsonReport(benchmarkData);
  const { summary, metrics, tokenCounts, scenarios, environment } = report;

  const statusBadge = summary.overallPassed ? '✅ **PASSED**' : '❌ **FAILED**';

  const rows = [
    {
      name: 'Task Success Rate',
      val: metrics.taskSuccessRate?.formattedValue || '0.0%',
      target: metrics.taskSuccessRate?.target || '>= 80%',
      passed: metrics.taskSuccessRate?.passed
    },
    {
      name: 'Test Pass Rate',
      val: metrics.testPassRate?.formattedValue || '0.0%',
      target: metrics.testPassRate?.target || '>= 80%',
      passed: metrics.testPassRate?.passed
    },
    {
      name: 'Recovery Rate',
      val: metrics.recoveryRate?.formattedValue || '100.0%',
      target: metrics.recoveryRate?.target || '>= 50%',
      passed: metrics.recoveryRate?.passed
    },
    {
      name: 'Average Retries',
      val: metrics.averageRetries?.formattedValue || '0.0',
      target: metrics.averageRetries?.target || '<= 1.5',
      passed: metrics.averageRetries?.passed
    },
    {
      name: 'Mean Runtime',
      val: metrics.runtime?.formattedMean || '0.0s',
      target: metrics.runtime?.target || '< 60.0s',
      passed: metrics.runtime?.passed
    },
    {
      name: 'Median Runtime',
      val: metrics.runtime?.formattedMedian || '0.0s',
      target: '< 60.0s',
      passed: (metrics.runtime?.medianSec || 0) < 60.0
    },
    {
      name: 'Files Changed',
      val: metrics.filesChanged?.formattedValue || '0.0 files/task',
      target: metrics.filesChanged?.target || '1.0 - 2.0 files/task',
      passed: metrics.filesChanged?.passed
    },
    {
      name: 'Diff Precision',
      val: metrics.diffPrecision?.formattedValue || '100.0%',
      target: metrics.diffPrecision?.target || '>= 90%',
      passed: metrics.diffPrecision?.passed
    },
    {
      name: 'Verification Rate',
      val: metrics.verificationRate?.formattedValue || '0.0%',
      target: metrics.verificationRate?.target || '>= 80%',
      passed: metrics.verificationRate?.passed
    }
  ];

  const scorecardTable = [
    '| Metric | Measured Value | Benchmark Target | Target Status |',
    '|---|---|---|---|',
    ...rows.map(r => `| **${r.name}** | ${r.val} | ${r.target} | ${r.passed ? 'PASS ✅' : 'FAIL ❌'} |`)
  ].join('\n');

  const scenarioTable = [
    '| Fixture ID | Category | Status | Baseline | Post-Exec | Attempts | Duration | Tokens | Files Changed |',
    '|---|---|---|---|---|---|---|---|---|',
    ...scenarios.map(s => {
      const durSec = ((s.durationMs || 0) / 1000).toFixed(1) + 's';
      const tokStr = (s.tokens?.totalTokens || 0).toLocaleString();
      const st = s.status === 'VERIFIED' || s.status === 'PASSED' ? 'VERIFIED ✅' : 'FAILED ❌';
      const baseExit = s.baseline?.exitCode !== undefined ? `exit ${s.baseline.exitCode}` : 'fail';
      const postExit = s.postExecution?.exitCode !== undefined ? `exit ${s.postExecution.exitCode}` : 'pass';
      const filesStr = (Array.isArray(s.changedFiles) && s.changedFiles.length > 0) ? s.changedFiles.join(', ') : 'none';
      return `| \`${s.fixtureId}\` | ${s.category} | ${st} | ${baseExit} | ${postExit} | ${s.validationAttempts} | ${durSec} | ${tokStr} | \`${filesStr}\` |`;
    })
  ].join('\n');

  const md = [
    '# OPTIMUS — Automated Benchmark Evaluation Report',
    '',
    `**Benchmark Run ID**: \`${report.benchmarkRunId}\`  `,
    `**Timestamp**: \`${report.timestamp}\`  `,
    `**Execution Mode**: \`${environment.executionMode}\`  `,
    `**Node / Platform**: \`${environment.nodeVersion} / ${environment.platform}\`  `,
    `**Suite Result**: ${statusBadge}`,
    '',
    '---',
    '',
    '## 1. Executive Metrics Scorecard',
    '',
    scorecardTable,
    '',
    '---',
    '',
    '## 2. Scenario Results Breakdown',
    '',
    scenarioTable,
    '',
    '---',
    '',
    '## 3. Self-Healing & Recovery Analysis',
    '',
    `- **Total Tasks**: ${summary.totalTasks}`,
    `- **Verified Tasks**: ${summary.passedTasks}`,
    `- **Initial Failures Triggering Recovery**: ${metrics.recoveryRate?.denominator || 0}`,
    `- **Successfully Recovered Tasks**: ${metrics.recoveryRate?.numerator || 0}`,
    `- **Recovery Rate**: ${metrics.recoveryRate?.formattedValue || '100.0%'}`,
    `- **Average Corrective Retries**: ${metrics.averageRetries?.formattedValue || '0.0'}`,
    '',
    '---',
    '',
    '## 4. Diff Precision & Scope Adherence',
    '',
    `- **Total Target Files Expected & Matched**: ${metrics.diffPrecision?.matchedFiles || 0}`,
    `- **Total Files Modified**: ${metrics.diffPrecision?.totalModified || 0}`,
    `- **Extraneous / Forbidden Files Modified**: ${metrics.diffPrecision?.extraneousFiles || 0}`,
    `- **Precision Score**: ${metrics.diffPrecision?.formattedValue || '100.0%'}`,
    '',
    '---',
    '',
    '## 5. Token Consumption & Cost Breakdown',
    '',
    `- **Total Input / Prompt Tokens**: ${tokenCounts.promptTokens.toLocaleString()}`,
    `- **Total Output / Completion Tokens**: ${tokenCounts.completionTokens.toLocaleString()}`,
    `- **Total Tokens Consumed**: ${tokenCounts.formattedTotalTokens}`,
    `- **Estimated Financial Cost**: ${tokenCounts.estimatedCost}`,
    '',
    '---',
    '',
    '## 6. Audit & Observability Telemetry',
    '',
    `- **Total Audit Events Recorded**: ${report.auditEventCount}`,
    '- **Security Verification**: All logs, diff previews, and report outputs scrubbed via scrubTokens() before serialization.',
    '',
    '---',
    '*Report generated automatically by OPTIMUS Benchmark Harness (Phase 17).*'
  ].join('\n');

  return md;
}

/**
 * Safely writes JSON and Markdown report files to the target directory.
 * Guarantees directory containment and path traversal protection.
 *
 * @param {Object} benchmarkData - Benchmark run results
 * @param {string} outputDir - Destination directory
 * @param {Object} [options] - Options (fileNamePrefix, etc.)
 * @returns {{ jsonPath: string, markdownPath: string, runId: string }}
 */
function writeReportFiles(benchmarkData = {}, outputDir, options = {}) {
  if (!outputDir || typeof outputDir !== 'string') {
    throw new Error('outputDir must be a non-empty string');
  }

  const resolvedTargetDir = path.resolve(outputDir);
  // Ensure output directory exists
  fs.mkdirSync(resolvedTargetDir, { recursive: true });

  const report = generateJsonReport(benchmarkData);
  const runId = report.benchmarkRunId;
  const prefix = options.fileNamePrefix ? sanitizeRunId(options.fileNamePrefix) : runId;

  const jsonFileName = `${prefix}-report.json`;
  const mdFileName = `${prefix}-report.md`;

  const jsonPath = path.resolve(resolvedTargetDir, jsonFileName);
  const markdownPath = path.resolve(resolvedTargetDir, mdFileName);

  // Path containment verification
  const dirWithSep = resolvedTargetDir.endsWith(path.sep) ? resolvedTargetDir : resolvedTargetDir + path.sep;
  if (!jsonPath.startsWith(dirWithSep) || !markdownPath.startsWith(dirWithSep)) {
    throw new Error('Path traversal violation: Report target path is outside allowed directory');
  }

  // Write JSON report
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  // Write Markdown report
  const markdownContent = generateMarkdownReport(report);
  fs.writeFileSync(markdownPath, markdownContent + '\n', 'utf8');

  return {
    jsonPath,
    markdownPath,
    mdPath: markdownPath,
    runId,
    report
  };
}

module.exports = {
  generateJsonReport,
  generateMarkdownReport,
  writeReportFiles,
  sanitizeRunId,
  deepScrub
};
