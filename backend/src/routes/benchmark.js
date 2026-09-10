/**
 * OPTIMUS — Phase 17.4 Benchmark Routes
 *
 * REST route definitions for the automated benchmark harness:
 * - POST /api/benchmark/run
 * - GET /api/benchmark/reports
 * - GET /api/benchmark/reports/:id
 * - GET /api/benchmark/reports/:id/markdown
 *
 * Middleware:
 * - requireAuth: Enforces authentication via JWT cookie
 * - benchmarkRunLimiter: Restricts benchmark triggering rate
 * - benchmarkReadLimiter: Protects report retrieval endpoints
 */

const express = require('express');
const router = express.Router();
const benchmarkController = require('../controllers/benchmark');
const { requireAuth } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');

// Rate limiter for resource-intensive benchmark execution (30 runs per 5 minutes)
const benchmarkRunLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 30,
  message: 'Too many benchmark runs requested. Please wait before retrying.'
});

// Rate limiter for report queries (120 requests per minute)
const benchmarkReadLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
  message: 'Too many report requests. Please throttle.'
});

// Require authentication across all benchmark endpoints
router.use(requireAuth);

// Trigger benchmark execution
router.post('/run', benchmarkRunLimiter, benchmarkController.runBenchmark);

// List generated benchmark reports
router.get('/reports', benchmarkReadLimiter, benchmarkController.listReports);

// Retrieve JSON scorecard report by run ID
router.get('/reports/:id', benchmarkReadLimiter, benchmarkController.getReportById);

// Retrieve Markdown evaluation report by run ID
router.get('/reports/:id/markdown', benchmarkReadLimiter, benchmarkController.getReportMarkdown);

module.exports = router;
