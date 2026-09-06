const BaseProviderAdapter = require('./baseAdapter');
const { tools: defaultTools } = require('../tools');
const {
  AIGatewayConfigurationError,
  AIGatewayAuthenticationError,
  AIGatewayRateLimitError,
  AIGatewayTimeoutError,
  AIGatewayResponseValidationError,
  AIGatewayProviderError,
  AIGatewayError
} = require('../gateway/errors');
const { scrubTokens } = require('../../agent/toolExecutors');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * OPTIMUS FREE OPENROUTER MODEL REGISTRY
 *
 * Strategy:
 * 1. Request-specific configured model gets priority.
 * 2. AI_MODEL gets priority when explicitly configured.
 * 3. Preferred free model for the request type is used.
 * 4. Additional free models are tried only after transient failures.
 * 5. openrouter/free remains the final dynamic free-router fallback.
 *
 * No paid model is used as a hardcoded fallback.
 */
const DEFAULT_FREE_MODELS = Object.freeze({
  PLANNING: 'z-ai/glm-5.2:free',
  AGENT: 'openai/gpt-oss-20b:free',
  REASONING: 'z-ai/glm-5.2:free',
  DEFAULT: 'openrouter/free',

  FREE_POOL: Object.freeze([
    'z-ai/glm-5.2:free',
    'openai/gpt-oss-20b:free',
    'minimax/minimax-m3:free',
    'nvidia/nemotron-3-ultra:free',
    'google/gemma-4-31b-it:free',
    'openrouter/free'
  ])
});

class OpenRouterAdapter extends BaseProviderAdapter {
  constructor() {
    super('openrouter');

    this.defaultModels = DEFAULT_FREE_MODELS;
  }

  /**
   * Return ordered, de-duplicated model candidates.
   *
   * Priority:
   * explicit model
   * request-specific environment model
   * AI_MODEL
   * request-specific free default
   * remaining free models
   */
  getModelCandidates(requestType, explicitModel) {
    if (explicitModel) {
      if (Array.isArray(explicitModel)) return explicitModel.filter(Boolean);
      if (typeof explicitModel === 'string' && explicitModel.includes(',')) {
        return explicitModel.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [explicitModel];
    }

    let requestEnvModel = null;

    switch (requestType) {
      case 'planning':
        requestEnvModel = process.env.AI_PLANNING_MODEL;
        break;

      case 'agent':
      case 'agent_execution':
      case 'agent_turn':
        requestEnvModel = process.env.AI_AGENT_MODEL;
        break;

      case 'reasoning':
      case 'structured_reasoning':
        requestEnvModel = process.env.AI_REASONING_MODEL;
        break;

      default:
        requestEnvModel = process.env.AI_MODEL;
        break;
    }

    let preferredFreeModel;

    switch (requestType) {
      case 'planning':
        preferredFreeModel = DEFAULT_FREE_MODELS.PLANNING;
        break;

      case 'agent':
      case 'agent_execution':
      case 'agent_turn':
        preferredFreeModel = DEFAULT_FREE_MODELS.AGENT;
        break;

      case 'reasoning':
      case 'structured_reasoning':
        preferredFreeModel = DEFAULT_FREE_MODELS.REASONING;
        break;

      default:
        preferredFreeModel = DEFAULT_FREE_MODELS.DEFAULT;
        break;
    }

    const candidates = [];

    if (explicitModel) {
      candidates.push(explicitModel);
    }

    if (requestEnvModel) {
      candidates.push(requestEnvModel);
      if (requestEnvModel.includes(',')) {
        candidates.push(...requestEnvModel.split(',').map(s => s.trim()).filter(Boolean));
      } else {
        candidates.push(requestEnvModel.trim());
      }
    }

    if (process.env.AI_MODEL) {
      candidates.push(process.env.AI_MODEL);
      if (process.env.AI_MODEL.includes(',')) {
        candidates.push(...process.env.AI_MODEL.split(',').map(s => s.trim()).filter(Boolean));
      } else {
        candidates.push(process.env.AI_MODEL.trim());
      }
    }

    candidates.push(preferredFreeModel);

    for (const freeModel of DEFAULT_FREE_MODELS.FREE_POOL) {
      candidates.push(freeModel);
    }

    return [...new Set(candidates.filter(Boolean))];
  }

  /**
   * Only transient provider failures are allowed to trigger
   * fallback to another free model.
   *
   * We do NOT switch models for:
   * - authentication errors
   * - malformed requests
   * - invalid model responses
   * - invalid JSON
   */
  isModelFallbackError(error) {
    if (!error) {
      return false;
    }

    // Never fallback for authentication or configuration errors
    if (
      error instanceof AIGatewayAuthenticationError ||
      error instanceof AIGatewayConfigurationError ||
      error instanceof AIGatewayResponseValidationError ||
      error.statusCode === 400 ||
      error.statusCode === 401 ||
      error.statusCode === 403
    ) {
      return false;
    }

    if (error instanceof AIGatewayRateLimitError || error.statusCode === 429) {
      return true;
    }

    if (error instanceof AIGatewayTimeoutError || error.statusCode === 408) {
      return true;
    }

    if (error instanceof AIGatewayProviderError) {
      return true;
    }

    if ([502, 503, 504].includes(error.statusCode)) {
      return true;
    }

    const msg = String(error.message || '').toLowerCase();
    if (
      msg.includes('model unavailable') ||
      msg.includes('model not found') ||
      msg.includes('rate limit') ||
      msg.includes('overloaded') ||
      msg.includes('temporarily unavailable')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Retrieve OpenRouter API key.
   *
   * Credentials must come from environment variables.
   * Never hardcode an API key.
   */
  getApiKey(context = 'planning') {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      const isTestEnv =
        process.env.NODE_ENV === 'test' ||
        process.env.ALLOW_AI_TEST_FALLBACK === 'true';

      if (!isTestEnv) {
        const errorMsg =
          context === 'agent'
            ? 'AI Provider Configuration Error: OPENROUTER_API_KEY is not configured. Real agent execution requires OPENROUTER_API_KEY in backend/.env.'
            : 'AI Provider Configuration Error: OPENROUTER_API_KEY is not configured. Please set OPENROUTER_API_KEY in backend/.env to enable autonomous planning.';

        throw new AIGatewayConfigurationError(errorMsg, {
          provider: this.name
        });
      }

      return null;
    }

    return apiKey;
  }

  /**
   * Deterministic test-mode fallback for plan generation.
   */
  getTestFallbackPlan(userPrompt) {
    let taskTitle = 'Engineering Task';

    const titleMatch = userPrompt.match(/Title:\s*(.+)/);

    if (titleMatch) {
      taskTitle = titleMatch[1].trim();
    }

    let contextFiles = [];

    try {
      const contextMatch = userPrompt.match(
        /REAL REPOSITORY CONTEXT:\s*(\{[\s\S]*\})/
      );

      if (contextMatch) {
        const parsedContext = JSON.parse(contextMatch[1]);

        contextFiles = (parsedContext.files || [])
          .map(file => file.path)
          .filter(Boolean);
      }
    } catch (_) {
      // Test fallback should never fail because repository context
      // could not be parsed.
    }

    const relevantFiles = contextFiles.filter(file => {
      const lower = file.toLowerCase();

      return (
        lower.includes('src') ||
        lower.includes('index') ||
        lower.includes('main') ||
        lower.includes('app')
      );
    });

    const targetFile =
      relevantFiles.length > 0
        ? relevantFiles[0]
        : contextFiles[0] || 'index.js';

    const summary =
      `Implementation plan for: ${taskTitle}. ` +
      `Analyze codebase architecture, implement required changes in ${targetFile}, ` +
      `and verify stability.`;

    const approach =
      `Inspect existing interfaces in ${targetFile}, ` +
      `apply targeted modular changes preserving architecture, ` +
      `and validate via automated test commands.`;

    const steps = [
      {
        title: `Step 1: Inspect Codebase Architecture and ${targetFile}`,
        description:
          `Read and analyze ${targetFile} to understand module structure ` +
          `and interfaces before applying modifications.`,
        filesAffected: [targetFile]
      },
      {
        title: `Step 2: Implement ${taskTitle}`,
        description:
          `Apply targeted changes to ${targetFile} implementing requirements ` +
          `with defensive error handling.`,
        filesAffected: [targetFile]
      },
      {
        title: 'Step 3: Verification & Regression Testing',
        description:
          `Execute test suite to ensure ${targetFile} satisfies requirements ` +
          `without regression.`,
        filesAffected: [targetFile]
      }
    ];

    const markdown =
      `### ${taskTitle}\n\n` +
      `#### Summary\n${summary}\n\n` +
      `#### Approach\n${approach}\n\n` +
      `#### Affected Files\n` +
      `- \`${targetFile}\`\n\n` +
      `#### Execution Steps\n` +
      `1. **Inspect Architecture**: Analyze \`${targetFile}\` structure and interfaces.\n` +
      `2. **Implement Changes**: Safely patch \`${targetFile}\`.\n` +
      `3. **Validate**: Run validation test commands.\n\n` +
      `#### Validation Strategy\n` +
      `Run test suite and verify exit code 0.`;

    return {
      plan: {
        summary,
        approach,
        steps,
        filesToInspect: [targetFile],
        filesExpectedToChange: [targetFile],
        implementationDetails:
          `Target file: ${targetFile}. Ensure interfaces and exports remain compatible.`,
        assumptions: [
          'Repository dependencies are present',
          'Target branch is clean'
        ],
        risks: [
          'Ensure existing functions are not inadvertently broken'
        ],
        validationStrategy:
          'Run project test suite and verify process exit code 0.',
        markdown
      },

      usage: {
        promptTokens: 100,
        completionTokens: 150,
        totalTokens: 250
      }
    };
  }

  /**
   * Deterministic test-mode fallback for agent turns.
   */
  getTestFallbackTurn(messages) {
    const hasPatched = messages.some(
      message =>
        message.content &&
        message.content.includes('Successfully patched')
    );

    if (!hasPatched) {
      return {
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_mock123',
              type: 'function',
              function: {
                name: 'apply_patch',
                arguments: JSON.stringify({
                  path: 'index.js',
                  oldText: 'console.log("hello world");\n',
                  newText: 'console.log("hello agent");\n'
                })
              }
            }
          ]
        },

        usage: {
          promptTokens: 80,
          completionTokens: 40,
          totalTokens: 120
        }
      };
    }

    return {
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_mock456',
            type: 'function',
            function: {
              name: 'complete_step',
              arguments: JSON.stringify({
                summary: 'Patched successfully'
              })
            }
          }
        ]
      },

      usage: {
        promptTokens: 90,
        completionTokens: 30,
        totalTokens: 120
      }
    };
  }

  /**
   * Normalize OpenRouter HTTP errors.
   */
  async handleHttpError(response) {
    let rawText = '';

    try {
      rawText = await response.text();
    } catch (_) {
      rawText = response.statusText || 'Unknown error';
    }

    const safeErrorText = scrubTokens(rawText);

    if (response.status === 401 || response.status === 403) {
      throw new AIGatewayAuthenticationError(
        `OpenRouter Authentication Error (${response.status}): ${safeErrorText}`,
        {
          statusCode: response.status,
          provider: this.name
        }
      );
    }

    if (response.status === 429) {
      throw new AIGatewayRateLimitError(
        `OpenRouter Rate Limit Exceeded (429): ${safeErrorText}`,
        {
          statusCode: 429,
          provider: this.name
        }
      );
    }

    if (response.status === 400) {
      throw new AIGatewayError(
        `OpenRouter Bad Request (400): ${safeErrorText}`,
        {
          statusCode: 400,
          isRetryable: false,
          provider: this.name
        }
      );
    }

    if (response.status >= 500) {
      throw new AIGatewayProviderError(
        `OpenRouter Server Error (${response.status}): ${safeErrorText}`,
        {
          statusCode: response.status,
          isRetryable: true,
          provider: this.name
        }
      );
    }

    throw new AIGatewayError(
      `OpenRouter API failed (${response.status}): ${safeErrorText}`,
      {
        statusCode: response.status,
        isRetryable: false,
        provider: this.name
      }
    );
  }

  /**
   * Execute planning request through OpenRouter.
   */
  async executePlan(systemPrompt, userPrompt, options = {}) {
    const apiKey = this.getApiKey('planning');

    if (!apiKey) {
      return this.getTestFallbackPlan(userPrompt);
    }

    const candidates = this.getModelCandidates(
      'planning',
      options.model
    );

    let lastError = null;

    for (
      let modelIndex = 0;
      modelIndex < candidates.length;
      modelIndex++
    ) {
      const model = candidates[modelIndex];

      try {
        const response = await fetch(OPENROUTER_API_URL, {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer':
              process.env.FRONTEND_URL || 'http://localhost:5173',
            'X-Title': 'OPTIMUS Code Forge'
          },

          body: JSON.stringify({
            model,

            response_format: {
              type: 'json_object'
            },

            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: userPrompt
              }
            ]
          }),

          signal: options.signal
        });

        if (!response.ok) {
          await this.handleHttpError(response);
        }

        const data = await response.json();

        if (
          !data.choices ||
          !data.choices[0] ||
          !data.choices[0].message
        ) {
          throw new AIGatewayResponseValidationError(
            'OpenRouter returned an empty or malformed choice payload',
            {
              provider: this.name,
              model
            }
          );
        }

        const rawContent = data.choices[0].message.content;

        let parsed;

        try {
          parsed = JSON.parse(rawContent);
        } catch (err) {
          throw new AIGatewayResponseValidationError(
            `Failed to parse plan JSON: ${err.message}`,
            {
              provider: this.name,
              model
            }
          );
        }

        const usage = data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens
            }
          : null;

        return {
          plan: parsed,
          usage,
          model,
          rawResponse: data
        };
      } catch (error) {
        lastError = error;

        /**
         * Move to the next FREE model only for transient errors.
         *
         * Example:
         * GLM -> 429 -> GPT-OSS -> 503 -> MiniMax -> success
         *
         * This prevents permanent failures such as malformed JSON
         * or invalid authentication from being hidden.
         */
        if (
          !this.isModelFallbackError(error) ||
          modelIndex === candidates.length - 1
        ) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  /**
   * Execute agent turn through OpenRouter.
   */
  async executeTurn(messages, options = {}) {
    const apiKey = this.getApiKey('agent');

    if (!apiKey) {
      return this.getTestFallbackTurn(messages);
    }

    const candidates = this.getModelCandidates(
      'agent',
      options.model
    );

    const tools = options.tools || defaultTools;

    let lastError = null;

    for (
      let modelIndex = 0;
      modelIndex < candidates.length;
      modelIndex++
    ) {
      const model = candidates[modelIndex];

      try {
        const response = await fetch(OPENROUTER_API_URL, {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer':
              process.env.FRONTEND_URL || 'http://localhost:5173',
            'X-Title': 'OPTIMUS Code Forge'
          },

          body: JSON.stringify({
            model,
            messages,
            tools,
            tool_choice: 'auto'
          }),

          signal: options.signal
        });

        if (!response.ok) {
          await this.handleHttpError(response);
        }

        const data = await response.json();

        if (
          !data.choices ||
          !data.choices[0] ||
          !data.choices[0].message
        ) {
          throw new AIGatewayResponseValidationError(
            'OpenRouter returned an empty or malformed choices payload for agent turn',
            {
              provider: this.name,
              model
            }
          );
        }

        const usage = data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens
            }
          : null;

        return {
          message: data.choices[0].message,
          usage,
          model,
          rawResponse: data
        };
      } catch (error) {
        lastError = error;

        if (
          !this.isModelFallbackError(error) ||
          modelIndex === candidates.length - 1
        ) {
          throw error;
        }
      }
    }

    throw lastError;
  }
}

OpenRouterAdapter.DEFAULT_FREE_MODELS = DEFAULT_FREE_MODELS;
OpenRouterAdapter.FREE_MODEL_REGISTRY = DEFAULT_FREE_MODELS.FREE_POOL;

module.exports = OpenRouterAdapter;
module.exports.DEFAULT_FREE_MODELS = DEFAULT_FREE_MODELS;
module.exports.FREE_MODEL_REGISTRY = DEFAULT_FREE_MODELS.FREE_POOL;