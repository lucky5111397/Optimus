/**
 * AI Provider Compatibility Bridge.
 * Delegates all calls to the AI Gateway to ensure that no caller bypasses
 * Gateway policies (validation, routing, timeouts, retries, and observability).
 */

const aiGateway = require('./gateway');

async function generatePlan(systemPrompt, userPrompt, options = {}) {
  return await aiGateway.generatePlan(systemPrompt, userPrompt, options);
}

async function agentTurn(messages, options = {}) {
  return await aiGateway.agentTurn(messages, options);
}

module.exports = {
  generatePlan,
  agentTurn,
  aiGateway
};
