#!/usr/bin/env node

/**
 * OPTIMUS — Phase 17.4 Benchmark CLI
 *
 * Command-line interface for orchestrating reproducible benchmark runs:
 * - Supports `npm run benchmark -- --mode=mock` and `npm run benchmark -- --mode=live`
 * - Supports selective fixture execution via `--fixtures=fixture-01-syntax-bug,fixture-02-async-concurrency`
 * - Validates arguments and rejects directory traversal attempts
 * - Outputs concise scorecard telemetry without leaking credentials
 * - Returns proper process exit codes (0 for pass, 1 for failure/error)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const runner = require('./benchmarkRunner');
const { scrubTokens } = require('../services/sandboxService');

function printUsage() {
  console.log(`
OPTIMUS Benchmark Harness CLI

Usage:
  npm run benchmark -- [options]
  node src/benchmark/cli.js [options]

Options:
  --mode=<mock|live>       Execution mode: 'mock' (default) or 'live'
  --fixtures=<id1,id2>     Comma-separated list of fixture IDs to run
  --preserve-workspace     Retain isolated workspaces on disk for inspection
  --output-dir=<path>      Custom directory for report output
  --help, -h               Show this help message

Examples:
  npm run benchmark -- --mode=mock
  npm run benchmark -- --mode=live --fixtures=fixture-01-syntax-bug
  node src/benchmark/cli.js --mode=mock --fixtures=fixture-01-syntax-bug,fixture-02-async-concurrency
`);
}

function parseArgs(args) {
  const options = {
    mode: 'mock',
    fixtures: null,
    preserveWorkspace: false,
    outputDir: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }

    if (arg.startsWith('--mode=')) {
      options.mode = arg.split('=')[1].trim().toLowerCase();
    } else if (arg === '--mode' && i + 1 < args.length) {
      options.mode = args[++i].trim().toLowerCase();
    } else if (arg.startsWith('--fixtures=')) {
      options.fixtures = arg.split('=')[1].trim();
    } else if (arg === '--fixtures' && i + 1 < args.length) {
      options.fixtures = args[++i].trim();
    } else if (arg === '--preserve-workspace' || arg === '--preserveWorkspace') {
      options.preserveWorkspace = true;
    } else if (arg.startsWith('--output-dir=')) {
      options.outputDir = arg.split('=')[1].trim();
    } else if (arg === '--output-dir' && i + 1 < args.length) {
      options.outputDir = args[++i].trim();
    } else if (arg.startsWith('--outputDir=')) {
      options.outputDir = arg.split('=')[1].trim();
    } else if (arg.startsWith('--')) {
      console.warn(`Warning: Unrecognized option "${arg}" ignored.`);
    }
  }

  return options;
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    printUsage();
    process.exit(0);
  }

  // 1. Validate execution mode
  if (options.mode !== 'mock' && options.mode !== 'live') {
    console.error(`Error: Invalid mode "${options.mode}". Valid modes are "mock" and "live".`);
    printUsage();
    process.exit(1);
  }

  // 2. Validate fixture selection & path traversal protection
  let selectedFixtures = null;
  if (options.fixtures) {
    const rawIds = options.fixtures.split(',').map(s => s.trim()).filter(Boolean);
    if (rawIds.length === 0) {
      console.error('Error: Fixtures argument specified but no valid fixture IDs were parsed.');
      process.exit(1);
    }

    for (const fId of rawIds) {
      if (!runner.validateFixtureId(fId)) {
        console.error(`Error: Invalid fixture ID "${scrubTokens(fId)}". Fixture ID must contain only alphanumeric characters, dashes, and underscores.`);
        process.exit(1);
      }
    }
    selectedFixtures = rawIds;
  }

  // 3. Resolve and validate output directory if provided
  let outputDir = null;
  if (options.outputDir) {
    outputDir = path.resolve(process.cwd(), options.outputDir);
  }

  console.log('====================================================');
  console.log(' OPTIMUS Automated Benchmark Harness (Phase 17.4)   ');
  console.log('====================================================');
  console.log(`Execution Mode : ${options.mode.toUpperCase()}`);
  console.log(`Fixtures Filter: ${selectedFixtures ? selectedFixtures.join(', ') : 'ALL Curated Fixtures (5)'}`);
  console.log(`Preserve Disk  : ${options.preserveWorkspace}`);
  console.log('----------------------------------------------------');

  try {
    const startTime = Date.now();
    const result = await runner.runBenchmark({
      mode: options.mode,
      fixtures: selectedFixtures,
      preserveWorkspace: options.preserveWorkspace,
      outputDir: outputDir || undefined
    });

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n====================================================');
    console.log(' BENCHMARK SCORECARD SUMMARY                        ');
    console.log('====================================================');
    console.log(`Run ID         : ${result.benchmarkRunId}`);
    console.log(`Overall Status : ${result.summary.status === 'PASSED' ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`Tasks Evaluated: ${result.summary.totalTasks}`);
    console.log(`Tasks Passed   : ${result.summary.passedTasks}`);
    console.log(`Success Rate   : ${result.metrics.taskSuccessRate.formattedValue} (Target: >= 80%)`);
    console.log(`Test Pass Rate : ${result.metrics.testPassRate.formattedValue} (Target: >= 80%)`);
    console.log(`Recovery Rate  : ${result.metrics.recoveryRate.formattedValue} (Target: >= 50%)`);
    console.log(`Diff Precision : ${result.metrics.diffPrecision.formattedValue} (Target: >= 90%)`);
    console.log(`Mean Runtime   : ${result.metrics.runtime?.formattedMean || (result.metrics.runtime?.meanMs / 1000).toFixed(1) + 's'} (Target: < 60s)`);
    console.log(`Total Tokens   : ${result.metrics.tokens?.formattedTotalTokens || result.metrics.tokens?.totalTokens?.toLocaleString() || 0}`);
    console.log(`Execution Time : ${elapsedSec}s`);
    console.log('----------------------------------------------------');
    console.log(`JSON Report    : ${result.reportPaths.json}`);
    console.log(`Markdown Report: ${result.reportPaths.markdown}`);
    console.log('====================================================\n');

    if (result.summary.status === 'PASSED') {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('\nBenchmark Execution Failed:');
    console.error(scrubTokens(err.message || String(err)));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  main
};
