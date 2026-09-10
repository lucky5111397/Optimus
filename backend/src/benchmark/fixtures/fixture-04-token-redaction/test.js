const assert = require('assert');
const { sanitizeLogs } = require('./src/sanitizer');

function runTests() {
  console.log('Running test suite for fixture-04-token-redaction...');

  // Test 1: GitHub token redaction (baseline passes)
  const ghLog = 'Connecting with token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890 to GitHub';
  const ghClean = sanitizeLogs(ghLog);
  assert(!ghClean.includes('ghp_'), 'GitHub token must not be present');
  assert(ghClean.includes('[REDACTED_GITHUB_TOKEN]'), 'GitHub token redaction placeholder expected');
  console.log('✓ GitHub token redacted');

  // Test 2: OpenRouter API key redaction (FAILS ON BASELINE)
  const orLog = 'OpenRouter request failed: key sk-or-v1-a1b2c3d4e5f678901234567890abcdef123456 invalid';
  const orClean = sanitizeLogs(orLog);
  assert(!orClean.includes('sk-or-v1-'), 'OpenRouter API key must not be present');
  assert(orClean.includes('[REDACTED_API_KEY]'), 'OpenRouter API key redaction placeholder expected');
  console.log('✓ OpenRouter API key redacted');

  // Test 3: Bearer Authorization token redaction (FAILS ON BASELINE)
  const authLog = 'Header Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDN rejected';
  const authClean = sanitizeLogs(authLog);
  assert(!authClean.includes('eyJhbGciOi'), 'Raw Bearer JWT must not be present');
  assert(authClean.includes('Bearer [REDACTED_TOKEN]'), 'Bearer token redaction placeholder expected');
  console.log('✓ Bearer token redacted');

  console.log('All tests passed successfully!');
}

try {
  runTests();
  process.exit(0);
} catch (err) {
  console.error('Test Suite Failed:', err.message);
  process.exit(1);
}
