const { tools: defaultTools } = require('../tools');
const BaseProviderAdapter = require('../adapters/baseAdapter');

const {
  AIGatewayError,
  AIGatewayConfigurationError,
  AIGatewayAuthenticationError,
  AIGatewayRateLimitError,
  AIGatewayTimeoutError,
  AIGatewayResponseValidationError,
  AIGatewayProviderError
} = require('./errors');

const { scrubTokens } = require('../../agent/toolExecutors');

/**
 * ============================================================
 * OPTIMUS FREE OPENROUTER MODEL REGISTRY
 * ============================================================
 *
 * All models below are intended to be FREE OpenRouter variants.
 *
 * Important:
 * - Do NOT put paid model IDs in this registry.
 * - Environment variables may explicitly override these defaults.
 * - When a transient provider failure occurs, the gateway moves
 *   to the next model in the relevant pool.
 *
 * Model pools are intentionally ordered:
 *   1. Strong coding / agent model
 *   2. Strong reasoning model
 *   3. Additional free fallback
 *   4. OpenRouter free router as final dynamic fallback
 */
const FREE_MODEL_REGISTRY = Object.freeze({
  PLANNING: Object.freeze([
    'z-ai/glm-5.2:free',
    'openai/gpt-oss-20b:free',
    'google/gemma-4-31b-it:free',
    'minimax/minimax-m3:free',
    'nvidia/nemotron-3-ultra:free',
    'openrouter/free'
  ]),

  AGENT: Object.freeze([
    'openai/gpt-oss-20b:free',
    'google/gemma-4-31b-it:free',
    'minimax/minimax-m3:free',
    'poolside/laguna-s-2.1:free',
    'nvidia/nemotron-3-ultra:free',
    'openrouter/free'
  ]),

  REASONING: Object.freeze([
    'z-ai/glm-5.2:free',
    'openai/gpt-oss-20b:free',
    'google/gemma-4-31b-it:free',
    'minimax/minimax-m3:free',
    'nvidia/nemotron-3-ultra:free',
    'openrouter/free'
  ]),

  DEFAULT: Object.freeze([
    'openai/gpt-oss-20b:free',
    'google/gemma-4-31b-it:free',
    'minimax/minimax-m3:free',
    'poolside/laguna-s-2.1:free',
    'nvidia/nemotron-3-ultra:free',
    'openrouter/free'
  ])
});

const FREE_MODEL_POOLS = FREE_MODEL_REGISTRY;

/**
 * Backward-compatible single-model defaults.
 *
 * Existing code may import DEFAULT_FREE_MODELS, so keep this export.
 */
const DEFAULT_FREE_MODELS = Object.freeze({
  PLANNING: FREE_MODEL_POOLS.PLANNING[0],
  AGENT: FREE_MODEL_POOLS.AGENT[0],
  REASONING: FREE_MODEL_POOLS.REASONING[0],
  DEFAULT: FREE_MODEL_POOLS.DEFAULT[0]
});

class AIGateway {
  constructor(options = {}) {
    this.providers = new Map();

    this.defaultProvider = options.defaultProvider || 'openrouter';

    this.defaultModels = DEFAULT_FREE_MODELS;

    this.modelPools = FREE_MODEL_POOLS;
    this.modelRegistry = FREE_MODEL_REGISTRY;

    this.defaultTimeoutMs = Math.min(
      parseInt(process.env.AI_GATEWAY_TIMEOUT_MS, 10) || 60000,
      60000
    );

    /**
     * We now allow up to 5 retries after the first model attempt.
     *
     * Maximum:
     *   attempt 1 = model #1
     *   attempt 2 = model #2
     *   attempt 3 = model #3
     *   attempt 4 = model #4
     *   attempt 5 = model #5
     *   attempt 6 = model #6
     *
     * This allows the FREE model pool to actually provide resilience.
     */
    this.defaultMaxRetries =
      options.maxRetries !== undefined
        ? Math.max(0, Math.min(Number(options.maxRetries), 5))
        : 5;

    // Allowed tool names for agent turn validation.
    this.allowedToolNames = new Set(
      defaultTools
        .map(tool => tool.function?.name)
        .filter(Boolean)
    );
  }

  /**
   * ------------------------------------------------------------
   * Provider registration
   * ------------------------------------------------------------
   */
  registerProvider(name, adapter) {
    if (!name || typeof name !== 'string') {
      throw new Error('Provider name must be a non-empty string');
    }

    if (!(adapter instanceof BaseProviderAdapter)) {
      throw new Error(
        `Provider adapter for "${name}" must extend BaseProviderAdapter`
      );
    }

    this.providers.set(name.toLowerCase(), adapter);
  }

  /**
   * ------------------------------------------------------------
   * Provider lookup
   * ------------------------------------------------------------
   */
  getProvider(name) {
    const providerName = (
      name || this.defaultProvider
    ).toLowerCase();

    const adapter = this.providers.get(providerName);

    if (!adapter) {
      throw new AIGatewayConfigurationError(
        `AI Provider "${providerName}" is not registered in the AI Gateway. Registered: [${Array.from(this.providers.keys()).join(', ')}]`,
        {
          provider: providerName
        }
      );
    }

    return adapter;
  }

  /**
   * ------------------------------------------------------------
   * Normalize request type -> model pool
   * ------------------------------------------------------------
   */
  getModelPool(requestType) {
    switch (requestType) {
      case 'planning':
        return this.modelPools.PLANNING;

      case 'agent_execution':
      case 'agent_turn':
        return this.modelPools.AGENT;

      case 'structured_reasoning':
      case 'reasoning':
        return this.modelPools.REASONING;

      default:
        return this.modelPools.DEFAULT;
    }
  }

  /**
   * ------------------------------------------------------------
   * Environment variable model override
   * ------------------------------------------------------------
   *
   * Explicit configuration takes priority over the free pool.
   */
  getEnvironmentModel(requestType) {
    switch (requestType) {
      case 'planning':
        return process.env.AI_PLANNING_MODEL || null;

      case 'agent_execution':
      case 'agent_turn':
        return process.env.AI_AGENT_MODEL || null;

      case 'structured_reasoning':
        return process.env.AI_REASONING_MODEL || null;

      default:
        return null;
    }
  }

  /**
   * ------------------------------------------------------------
   * Centralized model selection
   * ------------------------------------------------------------
   *
   * Priority:
   *
   * 1. Explicit request override
   * 2. Request-specific environment variable
   * 3. General AI_MODEL environment variable
   * 4. First model in the FREE pool
   */
  resolveModel(requestType, overrideModel) {
    if (overrideModel) {
      return overrideModel;
    }

    const environmentModel = this.getEnvironmentModel(requestType);

    if (environmentModel) {
      return environmentModel;
    }

    if (process.env.AI_MODEL) {
      return process.env.AI_MODEL;
    }

    const pool = this.getModelPool(requestType);

    return pool[0];
  }

  /**
   * ------------------------------------------------------------
   * Resolve complete fallback model list
   * ------------------------------------------------------------
   *
   * If an explicit model is supplied, only that model is used.
   *
   * If an explicit model or array of models is supplied, that is used.
   * Otherwise:
   *   request-specific env
   *   request-specific env (single or comma-separated)
   *       ↓
   *   AI_MODEL
   *   AI_MODEL (single or comma-separated)
   *       ↓
   *   FREE MODEL POOL
   */
  resolveModelCandidates(requestType, overrideModel) {
    return this.resolveModelPool(requestType, overrideModel);
  }

  resolveCandidateModels(requestType, overrideModel) {
    return this.resolveModelPool(requestType, overrideModel);
  }

  resolveModelPool(requestType, overrideModel) {
    if (Array.isArray(overrideModel) && overrideModel.length > 0) {
      return overrideModel.filter(Boolean);
    }

    if (overrideModel && typeof overrideModel === 'string') {
      const parts = overrideModel.includes(',')
        ? overrideModel.split(',').map(s => s.trim()).filter(Boolean)
        : [overrideModel.trim()];
      if (parts.length > 0) return parts;
    }

    const environmentModel = this.getEnvironmentModel(requestType);

    if (environmentModel) {
      const parts = environmentModel.includes(',')
        ? environmentModel.split(',').map(s => s.trim()).filter(Boolean)
        : [environmentModel.trim()];
      if (parts.length > 0) return parts;
    }

    if (process.env.AI_MODEL) {
      const parts = process.env.AI_MODEL.includes(',')
        ? process.env.AI_MODEL.split(',').map(s => s.trim()).filter(Boolean)
        : [process.env.AI_MODEL.trim()];
      if (parts.length > 0) return parts;
    }

    return [...this.getModelPool(requestType)];
  }

  /**
   * ------------------------------------------------------------
   * Retryability
   * ------------------------------------------------------------
   */
  isRetryableError(error) {
    if (!error) {
      return false;
    }

    // Never retry configuration failures.
    if (error instanceof AIGatewayConfigurationError) {
      return false;
    }

    // Never retry authentication failures.
    if (error instanceof AIGatewayAuthenticationError) {
      return false;
    }

    // Never retry malformed/invalid model responses.
    if (error instanceof AIGatewayResponseValidationError) {
      return false;
    }

    // Explicit client/auth failures.
    if (
      error.statusCode === 400 ||
      error.statusCode === 401 ||
      error.statusCode === 403
    ) {
      return false;
    }

    // Explicit retryable marker.
    if (error.isRetryable === true) {
      return true;
    }

    // Rate limiting.
    if (
      error instanceof AIGatewayRateLimitError ||
      error.statusCode === 429
    ) {
      return true;
    }

    // Temporary upstream failures.
    if (
      error.statusCode === 502 ||
      error.statusCode === 503 ||
      error.statusCode === 504
    ) {
      return true;
    }

    // Transient socket/network failures.
    // Transient socket/network/availability failures.
    const msg = String(error.message || '').toLowerCase();

    if (
      msg.includes('model unavailable') ||
      msg.includes('model not found') ||
      msg.includes('rate limit') ||
      msg.includes('overloaded') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('socket') ||
      msg.includes('eai_again') ||
      msg.includes('connection reset') ||
      msg.includes('temporarily unavailable')
    ) {
      return true;
    }

    if (error instanceof AIGatewayTimeoutError || error.statusCode === 408) {
      return true;
    }

    return false;
  }

  /**
   * ------------------------------------------------------------
   * Sleep
   * ------------------------------------------------------------
   */
  async sleep(ms) {
    if (process.env.NODE_ENV === 'test') {
      return new Promise(resolve => setTimeout(resolve, 10));
    }

    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * ------------------------------------------------------------
   * Resilient execution with FREE model failover
   * ------------------------------------------------------------
   *
   * Example:
   *
   *   GPT-OSS
   *      ↓ 429
   *   Gemma
   *      ↓ 503
   *   MiniMax
   *      ↓ timeout
   *   Laguna
   *      ↓
   *   Nemotron
   *      ↓
   *   openrouter/free
   */
  async executeWithRetry(
    operationName,
    requestType,
    options = {},
    executeFn
  ) {
    const providerName =
      options.provider || this.defaultProvider;

    const adapter = this.getProvider(providerName);

    const modelPool = this.resolveModelPool(
      requestType,
      options.model
    );

    const requestedRetries =
      options.maxRetries !== undefined
        ? Number(options.maxRetries)
        : this.defaultMaxRetries;

    const maxRetries = Math.max(
      0,
      Math.min(requestedRetries, modelPool.length - 1)
    );

    const timeoutMs = Math.min(
      Number(options.timeoutMs) || this.defaultTimeoutMs,
      60000
    );

    let lastError = null;

    const startTime = Date.now();
    const modelsAttempted = [];

    for (
      let attemptIndex = 0;
      attemptIndex <= maxRetries;
      attemptIndex++
    ) {
      const model = modelPool[attemptIndex];
      modelsAttempted.push(model);

      const abortController = new AbortController();

      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeoutMs);

      const attemptNumber = attemptIndex + 1;

      try {
        const result = await executeFn(adapter, {
          ...options,

          /**
           * IMPORTANT:
           * Current attempt's model is injected here.
           */
          model,

          timeoutMs,

          signal: abortController.signal,

          /**
           * Useful for audit/debugging.
           */
          modelAttempt: attemptNumber,

          modelPoolSize: modelPool.length
        });

        clearTimeout(timeoutId);

        const durationMs = Date.now() - startTime;
        const usage = result.usage || {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        };

        const metadata = {
          provider: adapter.name,
          model,
          finalModel: model,
          requestType,
          operationName,
          durationMs,
          attempts: attemptNumber,
          modelAttempt: attemptNumber,
          modelPoolSize: modelPool.length,
          modelFallbackUsed: attemptIndex > 0,
          fallbackUsed: attemptIndex > 0,
          modelsAttempted: [...modelsAttempted],
          cost: 'Cost unavailable / free model',
          usage,
          promptTokens: usage.promptTokens || 0,
          completionTokens: usage.completionTokens || 0,
          totalTokens: usage.totalTokens || 0
        };

        return {
          ...result,
          metadata
        };
      } catch (err) {
        clearTimeout(timeoutId);

        let normalizedError = err;

        /**
         * Timeout.
         */
        if (
          err?.name === 'AbortError' ||
          abortController.signal.aborted
        ) {
          normalizedError = new AIGatewayTimeoutError(
            `AI Gateway request timed out after ${timeoutMs}ms using model "${model}"`,
            {
              provider: adapter.name,
              model,
              statusCode: 408
            }
          );
        }

        /**
         * Unknown provider error.
         */
        else if (!(err instanceof AIGatewayError)) {
          normalizedError = new AIGatewayProviderError(
            `AI Gateway unexpected failure: ${scrubTokens(
              err?.message || 'Unknown provider error'
            )}`,
            {
              provider: adapter.name,
              model,
              details: err
            }
          );
        }

        lastError = normalizedError;

        const canRetry =
          attemptIndex < maxRetries &&
          this.isRetryableError(normalizedError);

        /**
         * ------------------------------------------------------
         * IMPORTANT:
         * Move to NEXT FREE MODEL.
         *
         * We intentionally do not retry the same model.
         * ------------------------------------------------------
         */
        if (canRetry) {
          const nextModel = modelPool[attemptIndex + 1];

          const delay =
            Math.min(
              500 * Math.pow(2, attemptIndex),
              3000
            ) +
            Math.floor(Math.random() * 100);

          await this.sleep(delay);

          /**
           * Continue loop.
           *
           * Next iteration automatically selects nextModel.
           */
          continue;
        }

        break;
      }
    }

    /**
     * Nothing succeeded.
     */
    if (!lastError) {
      lastError = new AIGatewayProviderError(
        `AI Gateway operation "${operationName}" failed without a usable error`,
        {
          provider: adapter.name
        }
      );
    }

    /**
     * Never leak secrets in final error messages.
     */
    lastError.message = scrubTokens(
      lastError.message || 'AI Gateway request failed'
    );

    throw lastError;
  }

  /**
   * ------------------------------------------------------------
   * Validate structured planning response
   * ------------------------------------------------------------
   */
  validatePlanResponse(rawPlan) {
    if (
      !rawPlan ||
      typeof rawPlan !== 'object'
    ) {
      throw new AIGatewayResponseValidationError(
        'Model returned empty or non-object plan payload'
      );
    }

    const summary =
      typeof rawPlan.summary === 'string' &&
      rawPlan.summary.trim()
        ? rawPlan.summary.trim()
        : (
            typeof rawPlan.title === 'string'
              ? rawPlan.title.trim()
              : 'Technical implementation plan'
          );

    const approach =
      typeof rawPlan.approach === 'string'
        ? rawPlan.approach
        : '';

    const steps = Array.isArray(rawPlan.steps)
      ? rawPlan.steps.map((step, idx) => ({
          title:
            typeof step?.title === 'string'
              ? step.title
              : `Step ${idx + 1}`,

          description:
            typeof step?.description === 'string'
              ? step.description
              : '',

          filesAffected:
            Array.isArray(step?.filesAffected)
              ? step.filesAffected.filter(
                  file => typeof file === 'string'
                )
              : []
        }))
      : [];

    const filesToInspect =
      Array.isArray(rawPlan.filesToInspect)
        ? rawPlan.filesToInspect.filter(
            file => typeof file === 'string'
          )
        : [];

    const filesExpectedToChange =
      Array.isArray(rawPlan.filesExpectedToChange)
        ? rawPlan.filesExpectedToChange.filter(
            file => typeof file === 'string'
          )
        : (
            Array.isArray(rawPlan.filesAffected)
              ? rawPlan.filesAffected.filter(
                  file => typeof file === 'string'
                )
              : []
          );

    const implementationDetails =
      typeof rawPlan.implementationDetails === 'string'
        ? rawPlan.implementationDetails
        : '';

    const assumptions =
      Array.isArray(rawPlan.assumptions)
        ? rawPlan.assumptions.filter(
            item => typeof item === 'string'
          )
        : [];

    const risks =
      Array.isArray(rawPlan.risks)
        ? rawPlan.risks.filter(
            item => typeof item === 'string'
          )
        : [];

    const validationStrategy =
      typeof rawPlan.validationStrategy === 'string'
        ? rawPlan.validationStrategy
        : 'Run project test suite.';

    const markdown =
      typeof rawPlan.markdown === 'string' &&
      rawPlan.markdown.trim()
        ? rawPlan.markdown
        : '### Implementation Plan\n\nNo detailed markdown returned.';

    return {
      summary,
      approach,
      steps,
      filesToInspect,
      filesExpectedToChange,
      implementationDetails,
      assumptions,
      risks,
      validationStrategy,
      markdown
    };
  }

  /**
   * ------------------------------------------------------------
   * Validate assistant message and tool calls
   * ------------------------------------------------------------
   */
  validateAgentTurnResponse(turnResult) {
    if (
      !turnResult ||
      typeof turnResult !== 'object' ||
      !turnResult.message
    ) {
      throw new AIGatewayResponseValidationError(
        'Model response missing assistant message object'
      );
    }

    const message = turnResult.message;

    if (message.role !== 'assistant') {
      message.role = 'assistant';
    }

    if (message.tool_calls) {
      if (!Array.isArray(message.tool_calls)) {
        throw new AIGatewayResponseValidationError(
          'Assistant tool_calls must be an array'
        );
      }

      for (const toolCall of message.tool_calls) {
        if (
          !toolCall ||
          typeof toolCall !== 'object'
        ) {
          throw new AIGatewayResponseValidationError(
            'Malformed tool call element'
          );
        }

        if (
          !toolCall.function ||
          typeof toolCall.function !== 'object'
        ) {
          throw new AIGatewayResponseValidationError(
            'Tool call missing function descriptor'
          );
        }

        const funcName =
          toolCall.function.name;

        if (
          !funcName ||
          typeof funcName !== 'string'
        ) {
          throw new AIGatewayResponseValidationError(
            'Tool call missing function name'
          );
        }

        /**
         * Only known sandbox tools are accepted.
         */
        if (!this.allowedToolNames.has(funcName)) {
          throw new AIGatewayResponseValidationError(
            `Model requested unknown tool: "${funcName}"`
          );
        }

        const argsStr =
          toolCall.function.arguments;

        if (typeof argsStr !== 'string') {
          throw new AIGatewayResponseValidationError(
            `Tool call arguments for "${funcName}" must be a JSON string`
          );
        }

        try {
          JSON.parse(argsStr);
        } catch (jsonErr) {
          throw new AIGatewayResponseValidationError(
            `Malformed JSON in tool call arguments for "${funcName}": ${jsonErr.message}`
          );
        }
      }
    }

    return turnResult;
  }

  /**
   * ------------------------------------------------------------
   * Generate implementation plan
   * ------------------------------------------------------------
   */
  async generatePlan(arg1, arg2, arg3 = {}) {
    let systemPrompt;
    let userPrompt;
    let options;

    /**
     * Object signature:
     *
     * generatePlan({
     *   systemPrompt,
     *   userPrompt,
     *   ...
     * })
     */
    if (
      typeof arg1 === 'object' &&
      arg1 !== null &&
      arg2 === undefined
    ) {
      systemPrompt = arg1.systemPrompt;
      userPrompt = arg1.userPrompt;
      options = arg1;
    } else {
      systemPrompt = arg1;
      userPrompt = arg2;
      options = arg3 || {};
    }

    if (!systemPrompt || !userPrompt) {
      throw new AIGatewayError(
        'Both systemPrompt and userPrompt are required for generatePlan',
        {
          statusCode: 400
        }
      );
    }

    const executionResult =
      await this.executeWithRetry(
        'generatePlan',
        'planning',
        options,
        async (adapter, opts) => {
          return await adapter.executePlan(
            systemPrompt,
            userPrompt,
            opts
          );
        }
      );

    const validatedPlan =
      this.validatePlanResponse(
        executionResult.plan
      );

    validatedPlan._metadata =
      executionResult.metadata;

    return validatedPlan;
  }

  /**
   * ------------------------------------------------------------
   * Agent execution turn
   * ------------------------------------------------------------
   */
  async agentTurn(arg1, arg2) {
    let messages;
    let options;

    /**
     * Object signature:
     *
     * agentTurn({
     *   messages,
     *   ...
     * })
     *
     * Fixed from the previous implementation where arg2={}
     * prevented this branch from being reached.
     */
    if (
      typeof arg1 === 'object' &&
      arg1 !== null &&
      !Array.isArray(arg1) &&
      arg2 === undefined
    ) {
      messages = arg1.messages;
      options = arg1;
    } else {
      messages = arg1;
      options = arg2 || {};
    }

    if (
      !Array.isArray(messages) ||
      messages.length === 0
    ) {
      throw new AIGatewayError(
        'Messages must be a non-empty array for agentTurn',
        {
          statusCode: 400
        }
      );
    }

    const executionResult =
      await this.executeWithRetry(
        'agentTurn',
        'agent_execution',
        options,
        async (adapter, opts) => {
          return await adapter.executeTurn(
            messages,
            opts
          );
        }
      );

    const validatedResult =
      this.validateAgentTurnResponse(
        executionResult
      );

    return {
      message: validatedResult.message,

      usage: executionResult.usage,

      metadata: executionResult.metadata
    };
  }
}

/**
 * Backward-compatible exports.
 */
AIGateway.DEFAULT_FREE_MODELS =
  DEFAULT_FREE_MODELS;

AIGateway.FREE_MODEL_POOLS =
  FREE_MODEL_POOLS;

AIGateway.FREE_MODEL_REGISTRY =
  FREE_MODEL_REGISTRY;

module.exports = AIGateway;

module.exports.DEFAULT_FREE_MODELS =
  DEFAULT_FREE_MODELS;

module.exports.FREE_MODEL_POOLS =
  FREE_MODEL_POOLS;

module.exports.FREE_MODEL_REGISTRY =
  FREE_MODEL_REGISTRY;