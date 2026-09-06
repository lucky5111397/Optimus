const mongoose = require('mongoose');

const taskContextSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    unique: true
  },
  fileTree: {
    type: mongoose.Schema.Types.Mixed, // Storing serialized paths/metadata relevant to the task
    default: []
  },
  symbols: {
    type: mongoose.Schema.Types.Mixed, // Storing relevant functions, classes, etc.
    default: []
  },
  dependencies: {
    type: mongoose.Schema.Types.Mixed, // Storing import/export relationships
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model('TaskContext', taskContextSchema);

