/**
 * Failure Taxonomy and Error Classification for Autonomous Agent Execution.
 * Maps operational errors into categorized, safe application-level failure types.
 */

const {
  AIGatewayConfigurationError,
  AIGatewayAuthenticationError,
  AIGatewayRateLimitError,
  AIGatewayTimeoutError,
  AIGatewayResponseValidationError,
  AIGatewayProviderError
} = require('../ai/gateway/errors');

const FailureTypes = {
  CONFIGURATION_FAILURE: 'CONFIGURATION_FAILURE',
  AUTHENTICATION_FAILURE: 'AUTHENTICATION_FAILURE',
  PROVIDER_FAILURE: 'PROVIDER_FAILURE',
  TIMEOUT_FAILURE: 'TIMEOUT_FAILURE',
  RATE_LIMIT_FAILURE: 'RATE_LIMIT_FAILURE',
  MALFORMED_OUTPUT: 'MALFORMED_OUTPUT',
  INVALID_TOOL_CALL: 'INVALID_TOOL_CALL',
  TOOL_EXECUTION_FAILURE: 'TOOL_EXECUTION_FAILURE',
  VALIDATION_FAILURE: 'VALIDATION_FAILURE',
  SELF_CORRECTION_EXHAUSTED: 'SELF_CORRECTION_EXHAUSTED',
  EXECUTION_BUDGET_EXHAUSTED: 'EXECUTION_BUDGET_EXHAUSTED',
  REPEATED_TOOL_LOOP: 'REPEATED_TOOL_LOOP'
};

/**
 * Classify any runtime execution error into a standard FailureType.
 * @param {Error|any} error
 * @returns {string} FailureType enum value
 */
function classifyFailure(error) {
  if (!error) return FailureTypes.TOOL_EXECUTION_FAILURE;

  const msg = (error.message || String(error)).toLowerCase();

  // AI Gateway typed errors
  if (error instanceof AIGatewayConfigurationError || msg.includes('openrouter_api_key')) {
    return FailureTypes.CONFIGURATION_FAILURE;
  }
  if (error instanceof AIGatewayAuthenticationError || msg.includes('401') || msg.includes('unauthorized')) {
    return FailureTypes.AUTHENTICATION_FAILURE;
  }
  if (error instanceof AIGatewayRateLimitError || msg.includes('429') || msg.includes('rate limit')) {
    return FailureTypes.RATE_LIMIT_FAILURE;
  }
  if (error instanceof AIGatewayTimeoutError || msg.includes('timed out') || msg.includes('timeout')) {
    return FailureTypes.TIMEOUT_FAILURE;
  }
  if (error instanceof AIGatewayResponseValidationError) {
    if (msg.includes('unknown tool') || msg.includes('tool call')) {
      return FailureTypes.INVALID_TOOL_CALL;
    }
    return FailureTypes.MALFORMED_OUTPUT;
  }
  if (error instanceof AIGatewayProviderError) {
    return FailureTypes.PROVIDER_FAILURE;
  }

  // Execution engine loop & budget boundaries
  if (msg.includes('repeated identical tool call') || msg.includes('tool call loop')) {
    return FailureTypes.REPEATED_TOOL_LOOP;
  }
  if (msg.includes('budget') || msg.includes('max turns') || msg.includes('exceeded wall-clock') || msg.includes('tool call limit')) {
    return FailureTypes.EXECUTION_BUDGET_EXHAUSTED;
  }
  if (msg.includes('self-correction') || msg.includes('validation failed after maximum') || msg.includes('repeated validation failure')) {
    return FailureTypes.SELF_CORRECTION_EXHAUSTED;
  }
  if (msg.includes('validation failed') || msg.includes('exit code')) {
    return FailureTypes.VALIDATION_FAILURE;
  }
  if (msg.includes('patch') || msg.includes('path traversal') || msg.includes('file')) {
    return FailureTypes.TOOL_EXECUTION_FAILURE;
  }

  return FailureTypes.TOOL_EXECUTION_FAILURE;
}

/**
 * Standardizes failure diagnostics for frontend presentation and audit trail.
 */
function formatFailureDiagnostics(error, options = {}) {
  const category = classifyFailure(error);
  const msg = error ? (error.message || String(error)) : 'Unknown error';
  const traceId = options.traceId || 'trace_unknown';

  let code = 'EXEC_ERR';
  let retryable = false;
  let userMessage = 'The task execution failed. Please check the logs or retry.';
  let suggestedAction = 'Review the failure logs in the Agent Terminal and retry execution.';

  switch (category) {
    case FailureTypes.CONFIGURATION_FAILURE:
      code = 'CONFIG_MISSING';
      userMessage = 'Execution failed due to missing configuration or API keys.';
      suggestedAction = 'Configure OPENROUTER_API_KEY in backend/.env to enable live code execution.';
      retryable = false;
      break;
    case FailureTypes.AUTHENTICATION_FAILURE:
      code = 'AUTH_REQUIRED';
      userMessage = 'Authentication with the upstream AI provider failed.';
      suggestedAction = 'Verify your AI API key and model permissions in backend/.env.';
      retryable = false;
      break;
    case FailureTypes.RATE_LIMIT_FAILURE:
      code = 'RATE_LIMITED';
      userMessage = 'AI provider rate limit reached. Please wait a moment and retry.';
      suggestedAction = 'Wait 30-60 seconds for provider limits to replenish, then click Retry Execution.';
      retryable = true;
      break;
    case FailureTypes.TIMEOUT_FAILURE:
      code = 'EXEC_TIMEOUT';
      userMessage = 'Execution timed out before completing the step.';
      suggestedAction = 'Decompose this task into smaller, modular steps or retry.';
      retryable = true;
      break;
    case FailureTypes.VALIDATION_FAILURE:
    case FailureTypes.SELF_CORRECTION_EXHAUSTED:
      code = 'VALIDATION_FAILED';
      userMessage = 'Code changes did not pass automated verification tests.';
      suggestedAction = 'Inspect the failing test output in the Agent Terminal and adjust plan requirements.';
      retryable = true;
      break;
    case FailureTypes.EXECUTION_BUDGET_EXHAUSTED:
      code = 'BUDGET_EXCEEDED';
      userMessage = 'Execution exceeded the safety turn or tool call limit.';
      suggestedAction = 'Break the task down into smaller discrete goals or retry with higher turn limits.';
      retryable = false;
      break;
    case FailureTypes.REPEATED_TOOL_LOOP:
      code = 'TOOL_LOOP';
      userMessage = 'The agent repeated the same tool call multiple times without progress.';
      suggestedAction = 'Refine the task instructions to provide clearer file targets or retry with a different model.';
      retryable = true;
      break;
    default:
      code = 'EXEC_FAILED';
      suggestedAction = 'Review the failure logs in the Agent Terminal and retry execution.';
      retryable = false;
  }

  return {
    category,
    code,
    userMessage,
    message: userMessage,
    diagnosticSummary: msg.length > 300 ? msg.substring(0, 300) + '...' : msg,
    suggestedAction,
    retryable,
    traceId
  };
}

module.exports = {
  FailureTypes,
  classifyFailure,
  formatFailureDiagnostics
};

