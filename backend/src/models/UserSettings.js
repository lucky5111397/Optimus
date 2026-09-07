const mongoose = require('mongoose');

const userSettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  envVars: [{
    key: {
      type: String,
      required: true,
      trim: true
    },
    value: {
      type: String,
      default: ''
    }
  }],
  aiPreferences: {
    defaultModel: {
      type: String,
      default: 'openrouter/free'
    },
    maxTurns: {
      type: Number,
      default: 25,
      min: 1,
      max: 100
    },
    autonomyLevel: {
      type: String,
      enum: ['supervised', 'autonomous'],
      default: 'supervised'
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('UserSettings', userSettingsSchema);
