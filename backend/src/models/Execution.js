const mongoose = require('mongoose');

const executionSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    unique: true
  },
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['QUEUED', 'RUNNING', 'VALIDATING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'QUEUED'
  },
  currentStep: {
    type: Number,
    default: 0
  },
  totalSteps: {
    type: Number,
    default: 0
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  error: {
    type: String
  },
  executionLogs: [{
    timestamp: Date,
    stream: { type: String, enum: ['stdout', 'stderr', 'system'] },
    text: String
  }],
  changedFiles: [String],
  validationResults: { type: mongoose.Schema.Types.Mixed },
  metadata: { type: mongoose.Schema.Types.Mixed },
  review: { type: mongoose.Schema.Types.Mixed },
  delivery: { type: mongoose.Schema.Types.Mixed },
  traceId: { type: String, index: true },
  failureDetails: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

executionSchema.index({ taskId: 1, createdAt: -1 });

module.exports = mongoose.model('Execution', executionSchema);

