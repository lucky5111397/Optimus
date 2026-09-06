const AIGateway = require('./aiGateway');
const errors = require('./errors');
const OpenRouterAdapter = require('../adapters/openRouterAdapter');

// Create default gateway singleton
const defaultGateway = new AIGateway();

// Register OpenRouter provider adapter as the default provider
const openRouterAdapter = new OpenRouterAdapter();
defaultGateway.registerProvider('openrouter', openRouterAdapter);

module.exports = defaultGateway;
module.exports.AIGateway = AIGateway;
module.exports.DEFAULT_FREE_MODELS = AIGateway.DEFAULT_FREE_MODELS;
module.exports.FREE_MODEL_POOLS = AIGateway.FREE_MODEL_POOLS;
module.exports.FREE_MODEL_REGISTRY = AIGateway.FREE_MODEL_REGISTRY;
module.exports.openRouterAdapter = openRouterAdapter;
module.exports.errors = errors;
module.exports.default = defaultGateway;

// Export error classes directly for convenience
Object.assign(module.exports, errors);

