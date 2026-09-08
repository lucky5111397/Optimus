const crypto = require('crypto');
const ExecutionEvent = require('../models/ExecutionEvent');
const { scrubTokens } = require('../agent/toolExecutors');

const MAX_EVENTS_PER_EXECUTION = 200;
const MAX_METADATA_SIZE = 4096;
const MAX_SUMMARY_CHARS = 500;

// In-memory counter for sequence numbering per execution
const sequenceCounters = new Map();

/**
 * Generates a stable, safe trace identifier for an execution run.
 * Format: opt_trace_<hex>
 */
function generateTraceId() {
  const uuid = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  return `opt_trace_${uuid}`;
}

/**
 * Deeply scrubs sensitive tokens, keys, and values from metadata objects.
 */
function scrubAuditMetadata(meta) {
  if (!meta || typeof meta !== 'object') return {};

  const clean = {};
  const sensitiveKeyPatterns = [
    /token/i,
    /password/i,
    /secret/i,
    /(?:^|_|-)key(?:$|_|-)|apikey|secretkey|privatekey/i,
    /auth/i,
    /cookie/i,
    /credential/i,
    /prompt/i,
    /rawresponse/i
  ];

  for (const [k, v] of Object.entries(meta)) {
    // Exclude or mask known sensitive keys
    if (sensitiveKeyPatterns.some(p => p.test(k))) {
      clean[k] = '[REDACTED]';
      continue;
    }

    if (typeof v === 'string') {
      const scrubbed = scrubTokens(v);
      clean[k] = scrubbed.length > 250 ? scrubbed.substring(0, 250) + '...[truncated]' : scrubbed;
    } else if (typeof v === 'number' || typeof v === 'boolean' || v === null) {
      clean[k] = v;
    } else if (Array.isArray(v)) {
      clean[k] = v.slice(0, 10).map(item => typeof item === 'string' ? scrubTokens(item).substring(0, 100) : item);
    } else if (typeof v === 'object') {
      clean[k] = scrubAuditMetadata(v);
    }
  }

  // Ensure overall metadata does not exceed bounded size
  try {
    const serialized = JSON.stringify(clean);
    if (serialized.length > MAX_METADATA_SIZE) {
      return { truncated: true, sizeBytes: serialized.length };
    }
  } catch (_) {
    return { truncated: true };
  }

  return clean;
}

/**
 * Records an immutable execution lifecycle event.
 */
async function recordEvent(eventData) {
  const {
    executionId,
    taskId,
    userId,
    traceId,
    eventType,
    stepIndex,
    turnNumber,
    toolName,
    durationMs,
    status,
    failureCategory,
    summary,
    metadata
  } = eventData;

  if (!executionId || !taskId || !userId || !traceId || !eventType) {
    throw new Error('Missing required execution event fields');
  }

  const execKey = executionId.toString();
  const currentSeq = (sequenceCounters.get(execKey) || 0) + 1;
  sequenceCounters.set(execKey, currentSeq);

  if (currentSeq > MAX_EVENTS_PER_EXECUTION) {
    // Drop excess events to prevent runaway database growth
    return null;
  }

  const safeSummary = scrubTokens(typeof summary === 'string' ? summary : String(eventType)).substring(0, MAX_SUMMARY_CHARS);
  const safeMeta = scrubAuditMetadata(metadata);

  const eventDoc = new ExecutionEvent({
    executionId,
    taskId,
    userId,
    traceId,
    eventType,
    sequenceNumber: currentSeq,
    stepIndex,
    turnNumber,
    toolName,
    durationMs,
    status: status || 'IN_PROGRESS',
    failureCategory,
    summary: safeSummary,
    metadata: safeMeta,
    timestamp: new Date()
  });

  try {
    await eventDoc.save();
  } catch (err) {
    if (process.env.NODE_ENV === 'test' || !ExecutionEvent.db || ExecutionEvent.db.readyState !== 1) {
      return eventDoc;
    }
    throw err;
  }
  return eventDoc;
}

/**
 * Clears in-memory sequence counter when execution completes.
 */
function resetSequenceCounter(executionId) {
  if (executionId) {
    sequenceCounters.delete(executionId.toString());
  }
}

/**
 * Retrieves paginated or incremental immutable audit events for an execution.
 */
async function getExecutionEvents(executionId, options = {}) {
  const query = { executionId };
  if (options.eventType) {
    query.eventType = options.eventType;
  }

  // Support incremental cursor polling via sinceSequence
  if (options.sinceSequence !== undefined && options.sinceSequence !== null) {
    const seq = parseInt(options.sinceSequence, 10);
    if (!isNaN(seq) && seq >= 0) {
      query.sequenceNumber = { $gt: seq };
    }
  }

  const limit = Math.min(200, Math.max(1, parseInt(options.limit, 10) || (options.page ? 50 : 200)));

  if (options.page) {
    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      ExecutionEvent.find(query)
        .sort({ sequenceNumber: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ExecutionEvent.countDocuments(query)
    ]);

    return {
      events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Default array return for direct telemetry/polling
  const events = await ExecutionEvent.find(query)
    .sort({ sequenceNumber: 1 })
    .limit(limit)
    .lean();

  return events;
}

module.exports = {
  generateTraceId,
  recordEvent,
  resetSequenceCounter,
  getExecutionEvents,
  scrubAuditMetadata,
  MAX_EVENTS_PER_EXECUTION
};
