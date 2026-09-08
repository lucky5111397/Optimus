const mongoose = require('mongoose');

const executionEventSchema = new mongoose.Schema({
  executionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Execution',
    required: true,
    index: true
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  traceId: {
    type: String,
    required: true,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    enum: [
      'EXECUTION_CREATED',
      'EXECUTION_STARTED',
      'PLAN_STARTED',
      'PLAN_COMPLETED',
      'STEP_STARTED',
      'AI_TURN_STARTED',
      'AI_TURN_COMPLETED',
      'TOOL_CALL_STARTED',
      'TOOL_CALL_COMPLETED',
      'VALIDATION_STARTED',
      'VALIDATION_COMPLETED',
      'SELF_CORRECTION_STARTED',
      'SELF_CORRECTION_COMPLETED',
      'EXECUTION_COMPLETED',
      'EXECUTION_FAILED',
      'EXECUTION_CANCELLED',
      'ROLLBACK_STARTED',
      'ROLLBACK_COMPLETED',
      'EXECUTION_RECOVERY_STARTED',
      'EXECUTION_RECOVERED',
      'EXECUTION_STALE',
      'EXECUTION_LOCK_ACQUIRED',
      'EXECUTION_LOCK_RELEASED',
      'IDEMPOTENCY_REUSED',
      'ROLLBACK_FAILED',
      'DELIVERY_STARTED',
      'DELIVERY_BRANCH_PREPARED',
      'DELIVERY_COMMITTED',
      'DELIVERY_PUSHED',
      'DELIVERY_PR_CREATED',
      'DELIVERY_COMPLETED',
      'DELIVERY_FAILED',
      'PR_SYNCHRONIZED',
      'PR_MERGED',
      'PR_CLOSED',
      'CI_CHECK_UPDATED'
    ]
  },
  sequenceNumber: {
    type: Number,
    required: true
  },
  stepIndex: {
    type: Number
  },
  turnNumber: {
    type: Number
  },
  toolName: {
    type: String
  },
  durationMs: {
    type: Number
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILED', 'IN_PROGRESS', 'CANCELLED', 'SKIPPED']
  },
  failureCategory: {
    type: String
  },
  summary: {
    type: String,
    maxlength: 500
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  }
}, {
  timestamps: false,
  versionKey: false
});

// Compound indexes for fast, chronological queries and uniqueness
executionEventSchema.index({ executionId: 1, sequenceNumber: 1 }, { unique: true });
executionEventSchema.index({ taskId: 1, sequenceNumber: 1 });
executionEventSchema.index({ traceId: 1, sequenceNumber: 1 });
executionEventSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('ExecutionEvent', executionEventSchema);
