const mongoose = require('mongoose');

const repositorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider: {
    type: String,
    enum: ['github'],
    default: 'github'
  },
  owner: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['IMPORTING', 'INDEXING', 'READY', 'FAILED'],
    default: 'IMPORTING'
  },
  url: {
    type: String
  },
  defaultBranch: {
    type: String
  },
  errorMessage: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, { timestamps: true });

// Prevent duplicate repos for the same user
repositorySchema.index({ userId: 1, owner: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Repository', repositorySchema);

