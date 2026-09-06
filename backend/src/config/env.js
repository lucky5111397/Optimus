/**
 * Lightweight environment configuration validator.
 * Ensures required settings exist without blocking local development.
 */
function validateEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const warnings = [];
  const errors = [];

  // Required production configuration
  if (isProduction) {
    if (!process.env.MONGODB_URI) {
      errors.push('MONGODB_URI is required in production.');
    }
    if (!process.env.JWT_SECRET) {
      errors.push('JWT_SECRET is required in production.');
    }
  } else {
    if (!process.env.JWT_SECRET) {
      warnings.push('JWT_SECRET is not set; using local development fallback secret.');
    }
  }

  // Informational warnings for optional services
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    warnings.push('GitHub OAuth credentials not set (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET).');
  }

  if (!process.env.OPENROUTER_API_KEY) {
    warnings.push('OPENROUTER_API_KEY not set; AI agent will operate in local development fallback mode.');
  }

  for (const warning of warnings) {
    console.warn(`[Config Info] ${warning}`);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`[Config Error] ${error}`);
    }
    throw new Error(`Configuration validation failed: ${errors.join('; ')}`);
  }
}

module.exports = { validateEnv };
