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
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
