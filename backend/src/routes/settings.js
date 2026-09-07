const express = require('express');
const { requireAuth } = require('../middleware/auth');
const settingsController = require('../controllers/settings');

const router = express.Router();

router.use(requireAuth);

router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);
router.put('/environment', settingsController.updateEnvironment);
router.put('/ai', settingsController.updateAiPreferences);

module.exports = router;
