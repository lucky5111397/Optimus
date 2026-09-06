/**
 * Base Provider Adapter interface.
 * Defines the contract that every AI provider adapter must satisfy.
 */

class BaseProviderAdapter {
  constructor(name) {
    if (!name) {
      throw new Error('Provider adapter must define a name');
    }
    this.name = name;
  }

  /**
   * Execute planning prompt and return raw structured plan and token usage.
   * @param {string} systemPrompt
   * @param {string} userPrompt
   * @param {object} options - { model, timeoutMs, signal, headers }
   * @returns {Promise<{ plan: object, usage?: object, rawResponse?: any }>}
   */
  async executePlan(systemPrompt, userPrompt, options = {}) {
    throw new Error(`executePlan() must be implemented by adapter "${this.name}"`);
  }

  /**
   * Execute agent turn and return assistant response message with tool calls and usage.
   * @param {Array<object>} messages
   * @param {object} options - { tools, model, timeoutMs, signal }
   * @returns {Promise<{ message: object, usage?: object, rawResponse?: any }>}
   */
  async executeTurn(messages, options = {}) {
    throw new Error(`executeTurn() must be implemented by adapter "${this.name}"`);
  }
}

module.exports = BaseProviderAdapter;

