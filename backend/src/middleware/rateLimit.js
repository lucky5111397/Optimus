/**
 * In-Memory Sliding Window Rate Limiter Middleware
 * Provides protection against brute force and denial of service attacks without external dependencies.
 */

function createRateLimiter({ windowMs = 15 * 60 * 1000, maxRequests = 100, message = 'Too many requests, please try again later.' } = {}) {
  const requests = new Map();

  // Periodic cleanup of stale entries every 5 minutes
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of requests.entries()) {
      if (now - entry.windowStart > windowMs) {
        requests.delete(ip);
      }
    }
  }, 5 * 60 * 1000);

  // Unref timer so it doesn't prevent Node process from gracefully exiting
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  return function rateLimiter(req, res, next) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) || req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();

    let clientData = requests.get(ip);

    if (!clientData || now - clientData.windowStart > windowMs) {
      clientData = {
        windowStart: now,
        count: 1
      };
      requests.set(ip, clientData);
    } else {
      clientData.count += 1;
    }

    const remaining = Math.max(0, maxRequests - clientData.count);
    const resetTimeSeconds = Math.ceil((clientData.windowStart + windowMs - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTimeSeconds);

    if (clientData.count > maxRequests) {
      res.setHeader('Retry-After', resetTimeSeconds);
      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message
        }
      });
    }

    next();
  };
}

// Stricter limiter for authentication routes (login, token refresh, connect)
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 60,           // 60 requests per 15 min
  message: 'Too many authentication attempts. Please try again in 15 minutes.'
});

// Standard limiter for resource-intensive task creation & execution routes
const taskLimiter = createRateLimiter({
  windowMs: 60 * 1000,       // 1 minute
  maxRequests: 120,          // 120 requests per minute
  message: 'Too many task operations. Please wait a moment before trying again.'
});

// Limiter for inbound GitHub webhooks (allows bursts while protecting against DoS)
const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000,       // 1 minute
  maxRequests: 300,          // 300 requests per minute
  message: 'Too many webhook events received. Please throttle.'
});

module.exports = {
  createRateLimiter,
  authLimiter,
  taskLimiter,
  webhookLimiter
};
