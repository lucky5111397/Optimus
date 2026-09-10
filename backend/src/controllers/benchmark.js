/**
 * OPTIMUS — Phase 17.4 Benchmark Controller
 *
 * Exposes authenticated, rate-limited REST endpoints for:
 * - Triggering reproducible benchmark runs (POST /api/benchmark/run)
 * - Listing available benchmark run reports (GET /api/benchmark/reports)
 * - Fetching structured JSON benchmark scorecards (GET /api/benchmark/reports/:id)
 * - Fetching human-readable Markdown evaluation reports (GET /api/benchmark/reports/:id/markdown)
 *
 * Guarantees:
 * - Strict input validation on mode, fixture IDs, and report IDs
 * - Zero directory traversal vulnerabilities (path containment checks)
 * - Token and credential scrubbing on all error output
 * - In-flight execution concurrency guard (prevents resource thrashing)
 * - Standardized OPTIMUS response envelope
 */

const path = require('path');
const fsp = require('fs/promises');
const runner = require('../benchmark/benchmarkRunner');
const { sanitizeRunId } = require('../benchmark/reportGenerator');
const { scrubTokens } = require('../services/sandboxService');

// State guard to prevent concurrent benchmark runs from exhausting system resources
let isBenchmarkRunning = false;

/**
 * Validates that an ID string is safe and contains only allowed characters.
 * Rejects path traversal sequences (../, ..\), slashes, and null bytes.
 */
function isSafeIdentifier(id) {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (!trimmed || trimmed.length > 100) return false;
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0')) {
    return false;
  }
  return /^[a-zA-Z0-9_.-]+$/.test(trimmed);
}

/**
 * POST /api/benchmark/run
 * Initiates an automated benchmark evaluation run.
 */
exports.runBenchmark = async (req, res) => {
  if (isBenchmarkRunning) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'BENCHMARK_ALREADY_RUNNING',
        message: 'A benchmark run is already in progress. Please wait for it to complete.'
      }
    });
  }

  const { mode = 'mock', fixtures, preserveWorkspace = false } = req.body || {};

  // 1. Validate mode
  if (mode !== 'mock' && mode !== 'live') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_MODE',
        message: 'Invalid mode. Supported execution modes are "mock" and "live".'
      }
    });
  }

  // 2. Validate fixtures filter if provided
  let targetFixtures = undefined;
  if (fixtures !== undefined && fixtures !== null) {
    if (!Array.isArray(fixtures)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FIXTURES',
          message: 'Fixtures must be an array of fixture ID strings.'
        }
      });
    }

    if (fixtures.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMPTY_FIXTURES',
          message: 'Fixtures array cannot be empty when specified.'
        }
      });
    }

    for (const fId of fixtures) {
      if (!isSafeIdentifier(fId) || !runner.validateFixtureId(fId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FIXTURE_ID',
            message: `Invalid fixture ID "${scrubTokens(String(fId))}". Directory traversal or invalid characters detected.`
          }
        });
      }
    }
    targetFixtures = fixtures;
  }

  // 3. Execute benchmark
  isBenchmarkRunning = true;
  try {
    const result = await runner.runBenchmark({
      mode,
      fixtures: targetFixtures,
      preserveWorkspace: Boolean(preserveWorkspace)
    });

    return res.status(200).json({
      success: true,
      data: {
        benchmarkRunId: result.benchmarkRunId,
        timestamp: result.timestamp,
        mode: result.mode,
        status: result.summary.status,
        summary: result.summary,
        metrics: result.metrics,
        scenarios: result.scenarios,
        reportPaths: {
          json: path.basename(result.reportPaths.json),
          markdown: path.basename(result.reportPaths.markdown)
        }
      }
    });
  } catch (err) {
    console.error('[Benchmark Controller Run Error]', err.message || err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'BENCHMARK_EXECUTION_FAILED',
        message: scrubTokens(err.message || 'Benchmark execution failed')
      }
    });
  } finally {
    isBenchmarkRunning = false;
  }
};

/**
 * GET /api/benchmark/reports
 * Lists all generated benchmark report scorecards.
 */
exports.listReports = async (req, res) => {
  try {
    const reportsDir = runner.DEFAULT_REPORTS_DIR;
    await fsp.mkdir(reportsDir, { recursive: true });

    const entries = await fsp.readdir(reportsDir, { withFileTypes: true });
    const reportFiles = entries.filter(e => e.isFile() && e.name.endsWith('-report.json'));

    const reports = [];
    for (const file of reportFiles) {
      try {
        const fullPath = path.resolve(reportsDir, file.name);

        // Path containment check
        const dirWithSep = reportsDir.endsWith(path.sep) ? reportsDir : reportsDir + path.sep;
        if (!fullPath.startsWith(dirWithSep)) continue;

        const content = await fsp.readFile(fullPath, 'utf8');
        const parsed = JSON.parse(content);

        reports.push({
          benchmarkRunId: parsed.benchmarkRunId || file.name.replace('-report.json', ''),
          timestamp: parsed.timestamp || null,
          mode: parsed.environment?.executionMode || 'unknown',
          status: parsed.metrics?.summary?.status || 'UNKNOWN',
          taskSuccessRate: parsed.metrics?.taskSuccessRate?.value ?? null,
          testPassRate: parsed.metrics?.testPassRate?.value ?? null,
          totalTasks: parsed.metrics?.summary?.totalTasks ?? 0,
          passedTasks: parsed.metrics?.summary?.passedTasks ?? 0,
          fileName: file.name
        });
      } catch (_) {
        // Skip unparseable files safely
      }
    }

    // Sort descending by timestamp
    reports.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    return res.status(200).json({
      success: true,
      data: reports
    });
  } catch (err) {
    console.error('[Benchmark Controller List Error]', err.message || err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'LIST_REPORTS_FAILED',
        message: 'Failed to retrieve benchmark reports.'
      }
    });
  }
};

/**
 * GET /api/benchmark/reports/:id
 * Retrieves the JSON report for a specific benchmark run ID.
 */
exports.getReportById = async (req, res) => {
  const rawId = req.params.id;

  if (!isSafeIdentifier(rawId)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REPORT_ID',
        message: 'Invalid report ID specified. Path traversal characters are not permitted.'
      }
    });
  }

  const cleanId = rawId.replace(/-report\.json$/, '');
  const safeRunId = sanitizeRunId(cleanId);
  const reportsDir = runner.DEFAULT_REPORTS_DIR;
  const jsonPath = path.resolve(reportsDir, `${safeRunId}-report.json`);

  // Path containment verification
  const dirWithSep = reportsDir.endsWith(path.sep) ? reportsDir : reportsDir + path.sep;
  if (!jsonPath.startsWith(dirWithSep)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'PATH_TRAVERSAL_DETECTED',
        message: 'Path traversal violation: Target report path is outside allowed directory.'
      }
    });
  }

  try {
    const content = await fsp.readFile(jsonPath, 'utf8');
    const parsed = JSON.parse(content);
    return res.status(200).json({
      success: true,
      data: parsed
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REPORT_NOT_FOUND',
          message: `Benchmark report "${safeRunId}" not found.`
        }
      });
    }
    console.error('[Benchmark Controller Get Report Error]', err.message || err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'READ_REPORT_FAILED',
        message: 'Failed to read benchmark report.'
      }
    });
  }
};

/**
 * GET /api/benchmark/reports/:id/markdown
 * Retrieves the Markdown report for a specific benchmark run ID.
 */
exports.getReportMarkdown = async (req, res) => {
  const rawId = req.params.id;

  if (!isSafeIdentifier(rawId)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REPORT_ID',
        message: 'Invalid report ID specified. Path traversal characters are not permitted.'
      }
    });
  }

  const cleanId = rawId.replace(/-report\.md$/, '');
  const safeRunId = sanitizeRunId(cleanId);
  const reportsDir = runner.DEFAULT_REPORTS_DIR;
  const mdPath = path.resolve(reportsDir, `${safeRunId}-report.md`);

  // Path containment verification
  const dirWithSep = reportsDir.endsWith(path.sep) ? reportsDir : reportsDir + path.sep;
  if (!mdPath.startsWith(dirWithSep)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'PATH_TRAVERSAL_DETECTED',
        message: 'Path traversal violation: Target report path is outside allowed directory.'
      }
    });
  }

  try {
    const content = await fsp.readFile(mdPath, 'utf8');

    // Return as JSON if client explicitly requested application/json
    if (req.headers.accept && req.headers.accept.includes('application/json') && !req.headers.accept.includes('text/markdown')) {
      return res.status(200).json({
        success: true,
        data: {
          benchmarkRunId: safeRunId,
          markdown: content
        }
      });
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    return res.status(200).send(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REPORT_NOT_FOUND',
          message: `Benchmark markdown report "${safeRunId}" not found.`
        }
      });
    }
    console.error('[Benchmark Controller Get Markdown Error]', err.message || err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'READ_REPORT_FAILED',
        message: 'Failed to read markdown report.'
      }
    });
  }
};
