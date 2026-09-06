const mongoose = require('mongoose');

const taskPlanSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    unique: true
  },
  summary: {
    type: String,
    default: ''
  },
  approach: {
    type: String,
    default: ''
  },
  steps: [{
    title: { type: String, required: true },
    description: { type: String, default: '' },
    filesAffected: [{ type: String }]
  }],
  filesToInspect: [{ type: String }],
  filesExpectedToChange: [{ type: String }],
  implementationDetails: {
    type: String,
    default: ''
  },
  assumptions: [{ type: String }],
  risks: [{ type: String }],
  validationStrategy: {
    type: String,
    default: ''
  },
  markdown: {
    type: String,
    required: true
  },
  planHash: {
    type: String,
    required: true
  },
  version: {
    type: Number,
    default: 1
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  approvedAt: {
    type: Date
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('TaskPlan', taskPlanSchema);

