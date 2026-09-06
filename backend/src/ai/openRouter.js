/**
 * OpenRouter AI Provider Implementation (Compatibility Layer).
 * Delegates to OpenRouterAdapter under backend/src/ai/adapters/openRouterAdapter.js.
 * Preserves compatibility for existing unit and regression tests while removing
 * direct production usage in favor of the AI Gateway.
 */

const OpenRouterAdapter = require('./adapters/openRouterAdapter');

const adapter = new OpenRouterAdapter();

/**
 * Compatibility wrapper for generatePlan.
 */
async function generatePlan(systemPrompt, userPrompt, options = {}) {
  const result = await adapter.executePlan(systemPrompt, userPrompt, options);
  return result.plan;
}

/**
 * Compatibility wrapper for agentTurn.
 */
async function agentTurn(messages, options = {}) {
  const result = await adapter.executeTurn(messages, options);
  return { message: result.message };
}

module.exports = {
  generatePlan,
  agentTurn,
  OpenRouterAdapter,
  adapter
};
