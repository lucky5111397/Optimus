const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
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
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  status: {
    type: String,
    enum: [
      'DRAFT', 'ANALYZING', 'CONTEXT_READY', 'PLANNING', 'PLAN_READY', 
      'AWAITING_APPROVAL', 'IMPLEMENTING', 'TESTING', 
      'DIAGNOSING', 'RETRYING', 'VERIFYING', 'VERIFIED', 
      'ACCEPTED', 'DELIVERED', 'MERGED', 'CLOSED', 'FAILED', 'CANCELLED'
    ],
    default: 'DRAFT'
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH'],
    default: 'MEDIUM'
  },
  approvedPlanHash: {
    type: String
  },
  prUrl: {
    type: String
  },
  prNumber: {
    type: Number
  },
  deliveryBranch: {
    type: String
  },
  deliveredAt: {
    type: Date
  },
  deliveryStatus: {
    type: String,
    enum: ['NOT_STARTED', 'READY', 'PREPARING', 'COMMITTING', 'PUSHING', 'CREATING_PR', 'DELIVERED', 'FAILED'],
    default: 'NOT_STARTED'
  },
  deliveryError: {
    type: String
  },
  prState: {
    type: String,
    enum: ['open', 'closed', 'merged'],
    default: 'open'
  },
  prMergedAt: {
    type: Date
  },
  prClosedAt: {
    type: Date
  },
  ciStatus: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILURE', 'NEUTRAL', 'NONE'],
    default: 'NONE'
  },
  ciDetails: {
    type: mongoose.Schema.Types.Mixed
  },
  mergeableState: {
    type: String
  }
}, { timestamps: true });

taskSchema.index({ userId: 1, repositoryId: 1 });
taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ deliveryBranch: 1 }, { sparse: true });

module.exports = mongoose.model('Task', taskSchema);

