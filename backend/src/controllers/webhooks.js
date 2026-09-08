const {
  verifyWebhookSignature,
  isDuplicateDelivery,
  handlePingEvent,
  handlePullRequestEvent,
  handleCheckRunEvent
} = require('../services/webhookService');
const { scrubTokens } = require('../agent/toolExecutors');

/**
 * Primary GitHub Webhook Handler.
 * Secured with HMAC SHA-256 signature verification and delivery ID deduplication.
 */
exports.handleGithubWebhook = async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  const deliveryGuid = req.headers['x-github-delivery'];

  // Check required headers
  if (!signature || !event) {
    return res.status(400).json({
      error: 'Missing required GitHub webhook headers (X-Hub-Signature-256, X-GitHub-Event)'
    });
  }

  // Resolve webhook secret from environment
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret && process.env.NODE_ENV === 'production') {
    console.error('[Webhook] GITHUB_WEBHOOK_SECRET is not configured in production environment.');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // Cryptographic HMAC SHA-256 validation
  const effectiveSecret = webhookSecret || 'optimus_dev_webhook_secret';
  const rawBody = req.rawBody || JSON.stringify(req.body);

  const isValid = verifyWebhookSignature(rawBody, signature, effectiveSecret);
  if (!isValid) {
    console.warn('[Webhook] Invalid HMAC signature received for delivery:', deliveryGuid);
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  // Replay protection: deduplicate recently processed deliveries
  if (deliveryGuid && isDuplicateDelivery(deliveryGuid)) {
    return res.status(200).json({
      status: 'ignored',
      message: 'Duplicate delivery already processed',
      deliveryGuid
    });
  }

  try {
    let result = { status: 'ignored', reason: `Unhandled event type: ${event}` };

    switch (event) {
      case 'ping':
        result = handlePingEvent(req.body);
        break;

      case 'pull_request':
        result = await handlePullRequestEvent(req.body);
        break;

      case 'check_run':
        result = await handleCheckRunEvent(req.body);
        break;

      case 'check_suite':
        // For check_suite, if it has check_runs inside or conclusion
        if (req.body.check_suite) {
          result = await handleCheckRunEvent({
            check_run: {
              name: 'Check Suite',
              status: req.body.check_suite.status,
              conclusion: req.body.check_suite.conclusion,
              head_sha: req.body.check_suite.head_sha,
              html_url: req.body.check_suite.url
            },
            repository: req.body.repository
          });
        }
        break;

      default:
        result = { status: 'ignored', reason: `Event ${event} is not tracked by Optimus` };
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('[Webhook] Event processing error:', scrubTokens(error.message));
    return res.status(500).json({
      error: 'Failed to process webhook event',
      message: scrubTokens(error.message)
    });
  }
};
