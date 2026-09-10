/**
 * Validates and normalizes user registration payload.
 *
 * @param {Object} payload
 * @returns {{ valid: boolean, error?: string, data?: Object }}
 */
function validateRegistration(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload must be a non-empty object' };
  }

  const username = typeof payload.username === 'string' ? payload.username.trim() : '';
  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }

  const rawEmail = typeof payload.email === 'string' ? payload.email.trim() : '';
  if (!rawEmail || !rawEmail.includes('@') || !rawEmail.includes('.')) {
    return { valid: false, error: 'Valid email required' };
  }

  // BUG 1: Phone is strictly required, rejecting valid users who do not provide phone
  const phone = payload.phone;
  if (!phone || String(phone).replace(/\D/g, '').length < 10) {
    return { valid: false, error: 'Phone number is required and must be at least 10 digits' };
  }

  // BUG 2: Email is not normalized to lowercase
  return {
    valid: true,
    data: {
      username,
      email: rawEmail,
      phone: phone || null
    }
  };
}

module.exports = { validateRegistration };
