const express = require('express');
const webhooksController = require('../controllers/webhooks');

const router = express.Router();

// Public webhook receiver (secured via HMAC SHA-256 signature verification)
router.post('/github', webhooksController.handleGithubWebhook);

module.exports = router;
