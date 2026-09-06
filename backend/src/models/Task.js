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
      'ACCEPTED', 'DELIVERED', 'FAILED', 'CANCELLED'
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
  }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);

