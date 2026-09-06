const mongoose = require('mongoose');

const repositoryBranchSchema = new mongoose.Schema({
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  commitSha: {
    type: String,
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  lastIndexed: {
    type: Date
  },
  indexStatus: {
    type: String,
    enum: ['PENDING', 'INDEXING', 'READY', 'FAILED'],
    default: 'PENDING'
  },
  fileIndex: {
    type: mongoose.Schema.Types.Mixed // Will hold the indexed structure for now
  }
}, { timestamps: true });

repositoryBranchSchema.index({ repositoryId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('RepositoryBranch', repositoryBranchSchema);

