const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  githubId: {
    type: String,
    unique: true,
    sparse: true
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  username: {
    type: String
  },
  name: {
    type: String
  },
  email: {
    type: String
  },
  avatarUrl: {
    type: String
  },
  accessToken: {
    type: String
  },
  githubUsername: {
    type: String
  },
  provider: {
    type: String
  },
  role: {
    type: String,
    default: 'Software Engineer'
  },
  primaryLanguage: {
    type: String,
    default: 'JavaScript / TypeScript'
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
