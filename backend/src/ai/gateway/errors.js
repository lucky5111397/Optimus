/**
 * Typed error classes for the AI Gateway layer.
 * Enforces structured error codes and retryability flags.
 */

class AIGatewayError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code || 'AI_GATEWAY_ERROR';
    this.statusCode = options.statusCode || 500;
    this.isRetryable = options.isRetryable !== undefined ? options.isRetryable : false;
    this.provider = options.provider || null;
    this.details = options.details || null;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

class AIGatewayConfigurationError extends AIGatewayError {
  constructor(message, options = {}) {
    super(message, {
      code: 'AI_GATEWAY_CONFIGURATION_ERROR',
      statusCode: 500,
      isRetryable: false,
      ...options
    });
  }
}

class AIGatewayAuthenticationError extends AIGatewayError {
  constructor(message, options = {}) {
    super(message, {
      code: 'AI_GATEWAY_AUTHENTICATION_ERROR',
      statusCode: options.statusCode || 401,
      isRetryable: false,
      ...options
    });
  }
}

class AIGatewayRateLimitError extends AIGatewayError {
  constructor(message, options = {}) {
    super(message, {
      code: 'AI_GATEWAY_RATE_LIMIT_ERROR',
      statusCode: 429,
      isRetryable: true,
      ...options
    });
  }
}

class AIGatewayTimeoutError extends AIGatewayError {
  constructor(message, options = {}) {
    super(message, {
      code: 'AI_GATEWAY_TIMEOUT_ERROR',
      statusCode: 408,
      isRetryable: true,
      ...options
    });
  }
}

class AIGatewayResponseValidationError extends AIGatewayError {
  constructor(message, options = {}) {
    super(message, {
      code: 'AI_GATEWAY_VALIDATION_ERROR',
      statusCode: 502,
      isRetryable: false,
      ...options
    });
  }
}

class AIGatewayProviderError extends AIGatewayError {
  constructor(message, options = {}) {
    super(message, {
      code: 'AI_GATEWAY_PROVIDER_ERROR',
      statusCode: options.statusCode || 502,
      isRetryable: options.isRetryable !== undefined ? options.isRetryable : true,
      ...options
    });
  }
}

module.exports = {
  AIGatewayError,
  AIGatewayConfigurationError,
  AIGatewayAuthenticationError,
  AIGatewayRateLimitError,
  AIGatewayTimeoutError,
  AIGatewayResponseValidationError,
  AIGatewayProviderError
};

