const mongoose = require('mongoose');
const { scrubTokens } = require('../agent/toolExecutors');

const MAX_MESSAGE_LENGTH = 5000;

const taskMessageSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: MAX_MESSAGE_LENGTH
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Compound index for efficient ordered retrieval by task
taskMessageSchema.index({ taskId: 1, createdAt: 1 });

// Ensure any sensitive token patterns are scrubbed prior to persistence
taskMessageSchema.pre('save', function (next) {
  if (this.content && typeof this.content === 'string') {
    this.content = scrubTokens(this.content.substring(0, MAX_MESSAGE_LENGTH));
  }
  next();
});

module.exports = mongoose.model('TaskMessage', taskMessageSchema);
