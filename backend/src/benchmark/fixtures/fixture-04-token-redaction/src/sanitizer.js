/**
 * Sanitizes sensitive authentication credentials and secret tokens from strings.
 *
 * @param {string} str - Raw log or error string
 * @returns {string} Redacted safe string
 */
function sanitizeLogs(str) {
  if (typeof str !== 'string') {
    return str;
  }

  // Redacts GitHub Personal Access Tokens
  let sanitized = str.replace(/(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{20,80}/g, '[REDACTED_GITHUB_TOKEN]');

  // BUG: Missing redaction for OpenRouter API keys ('sk-or-v1-[a-zA-Z0-9]+')
  // BUG: Missing redaction for Bearer tokens ('Bearer [token]')

  return sanitized;
}

module.exports = { sanitizeLogs };
