const UserSettings = require('../models/UserSettings');

const VALID_ENV_KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ALLOWED_MODELS = [
  'openrouter/free',
  'openai/gpt-oss-20b:free',
  'z-ai/glm-5.2:free',
  'google/gemma-4-31b-it:free',
  'minimax/minimax-m3:free',
  'nvidia/nemotron-3-ultra:free'
];

/**
 * GET /api/settings
 * Retrieves user environment variables and AI preferences.
 */
exports.getSettings = async (req, res) => {
  try {
    let settings = await UserSettings.findOne({ userId: req.userId });
    if (!settings) {
      settings = {
        envVars: [],
        aiPreferences: {
          defaultModel: 'openrouter/free',
          maxTurns: 25,
          autonomyLevel: 'supervised'
        }
      };
    }
    return res.status(200).json({
      envVars: settings.envVars || [],
      aiPreferences: settings.aiPreferences || {
        defaultModel: 'openrouter/free',
        maxTurns: 25,
        autonomyLevel: 'supervised'
      }
    });
  } catch (error) {
    console.error('Get Settings Error:', error.message);
    return res.status(500).json({ error: 'Failed to retrieve settings' });
  }
};

/**
 * PUT /api/settings/environment
 * Validates and updates user environment variables.
 */
exports.updateEnvironment = async (req, res) => {
  try {
    const { envVars } = req.body;

    if (!Array.isArray(envVars)) {
      return res.status(400).json({ error: 'envVars must be an array' });
    }

    const sanitizedVars = [];
    const seenKeys = new Set();

    for (const item of envVars) {
      if (!item || typeof item !== 'object') continue;
      const rawKey = (item.key || '').trim();
      const rawVal = item.value !== undefined && item.value !== null ? String(item.value) : '';

      // Skip completely empty rows
      if (!rawKey && !rawVal) continue;

      if (!rawKey) {
        return res.status(400).json({ error: 'Environment variable key cannot be empty' });
      }

      if (rawKey.length > 100) {
        return res.status(400).json({ error: 'Environment variable key exceeds 100 characters' });
      }

      if (!VALID_ENV_KEY_REGEX.test(rawKey)) {
        return res.status(400).json({
          error: `Invalid environment variable key "${rawKey}". Keys must start with a letter or underscore and contain only alphanumeric characters and underscores.`
        });
      }

      if (rawVal.length > 5000) {
        return res.status(400).json({ error: `Value for "${rawKey}" exceeds maximum length of 5000 characters` });
      }

      if (seenKeys.has(rawKey)) {
        return res.status(400).json({ error: `Duplicate environment variable key "${rawKey}"` });
      }

      seenKeys.add(rawKey);
      sanitizedVars.push({ key: rawKey, value: rawVal });
    }

    const updated = await UserSettings.findOneAndUpdate(
      { userId: req.userId },
      { $set: { envVars: sanitizedVars } },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      message: 'Environment variables saved successfully',
      envVars: updated.envVars
    });
  } catch (error) {
    console.error('Update Environment Error:', error.message);
    return res.status(500).json({ error: 'Failed to update environment variables' });
  }
};

/**
 * PUT /api/settings/ai
 * Validates and updates user AI & execution preferences.
 */
exports.updateAiPreferences = async (req, res) => {
  try {
    const { defaultModel, maxTurns, autonomyLevel } = req.body;

    const updates = {};

    if (defaultModel !== undefined) {
      if (typeof defaultModel !== 'string' || !defaultModel.trim()) {
        return res.status(400).json({ error: 'defaultModel must be a non-empty string' });
      }
      const trimmedModel = defaultModel.trim();
      if (!ALLOWED_MODELS.includes(trimmedModel) && !/^[a-zA-Z0-9_\-\.\/:]+$/.test(trimmedModel)) {
        return res.status(400).json({ error: 'Invalid model format' });
      }
      updates['aiPreferences.defaultModel'] = trimmedModel;
    }

    if (maxTurns !== undefined) {
      const turns = parseInt(maxTurns, 10);
      if (isNaN(turns) || turns < 1 || turns > 100) {
        return res.status(400).json({ error: 'maxTurns must be an integer between 1 and 100' });
      }
      updates['aiPreferences.maxTurns'] = turns;
    }

    if (autonomyLevel !== undefined) {
      if (!['supervised', 'autonomous'].includes(autonomyLevel)) {
        return res.status(400).json({ error: 'autonomyLevel must be either "supervised" or "autonomous"' });
      }
      updates['aiPreferences.autonomyLevel'] = autonomyLevel;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid AI preference fields provided' });
    }

    const updated = await UserSettings.findOneAndUpdate(
      { userId: req.userId },
      { $set: updates },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      message: 'AI preferences saved successfully',
      aiPreferences: updated.aiPreferences
    });
  } catch (error) {
    console.error('Update AI Preferences Error:', error.message);
    return res.status(500).json({ error: 'Failed to update AI preferences' });
  }
};

/**
 * PUT /api/settings
 * Combined update for both environment variables and AI preferences.
 */
exports.updateSettings = async (req, res) => {
  try {
    const { envVars, aiPreferences } = req.body;
    const updates = {};

    if (envVars !== undefined) {
      if (!Array.isArray(envVars)) {
        return res.status(400).json({ error: 'envVars must be an array' });
      }
      const sanitizedVars = [];
      const seenKeys = new Set();
      for (const item of envVars) {
        if (!item || typeof item !== 'object') continue;
        const rawKey = (item.key || '').trim();
        const rawVal = item.value !== undefined && item.value !== null ? String(item.value) : '';
        if (!rawKey && !rawVal) continue;
        if (!rawKey) return res.status(400).json({ error: 'Environment variable key cannot be empty' });
        if (rawKey.length > 100) return res.status(400).json({ error: 'Key exceeds 100 characters' });
        if (!VALID_ENV_KEY_REGEX.test(rawKey)) {
          return res.status(400).json({ error: `Invalid environment variable key "${rawKey}"` });
        }
        if (rawVal.length > 5000) return res.status(400).json({ error: 'Value exceeds 5000 characters' });
        if (seenKeys.has(rawKey)) return res.status(400).json({ error: `Duplicate key "${rawKey}"` });
        seenKeys.add(rawKey);
        sanitizedVars.push({ key: rawKey, value: rawVal });
      }
      updates.envVars = sanitizedVars;
    }

    if (aiPreferences && typeof aiPreferences === 'object') {
      const { defaultModel, maxTurns, autonomyLevel } = aiPreferences;
      if (defaultModel !== undefined) {
        const trimmed = String(defaultModel).trim();
        if (!ALLOWED_MODELS.includes(trimmed) && !/^[a-zA-Z0-9_\-\.\/:]+$/.test(trimmed)) {
          return res.status(400).json({ error: 'Invalid defaultModel' });
        }
        updates['aiPreferences.defaultModel'] = trimmed;
      }
      if (maxTurns !== undefined) {
        const turns = parseInt(maxTurns, 10);
        if (isNaN(turns) || turns < 1 || turns > 100) {
          return res.status(400).json({ error: 'maxTurns must be between 1 and 100' });
        }
        updates['aiPreferences.maxTurns'] = turns;
      }
      if (autonomyLevel !== undefined) {
        if (!['supervised', 'autonomous'].includes(autonomyLevel)) {
          return res.status(400).json({ error: 'autonomyLevel must be "supervised" or "autonomous"' });
        }
        updates['aiPreferences.autonomyLevel'] = autonomyLevel;
      }
    }

    const updated = await UserSettings.findOneAndUpdate(
      { userId: req.userId },
      { $set: updates },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      message: 'Settings updated successfully',
      envVars: updated.envVars,
      aiPreferences: updated.aiPreferences
    });
  } catch (error) {
    console.error('Update Settings Error:', error.message);
    return res.status(500).json({ error: 'Failed to update settings' });
  }
};
