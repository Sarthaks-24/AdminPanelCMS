const PLACEHOLDER_SECRETS = ['super_secret_jwt_key_at_least_32_characters_long_replace_me'];

// Fail fast on unsafe configuration instead of booting with a guessable signing key.
function validateEnv(env = process.env) {
  const problems = [];
  const secret = env.JWT_SECRET || '';
  if (secret.length < 32) problems.push('JWT_SECRET must be set to a random value of at least 32 characters');
  else if (PLACEHOLDER_SECRETS.includes(secret) || /replace_me|changeme|your_.*_here/i.test(secret)) problems.push('JWT_SECRET is still the example placeholder; generate a random secret');
  if (env.NODE_ENV === 'production') {
    try {
      if (new URL(env.CLIENT_ORIGIN || '').protocol !== 'https:') problems.push('CLIENT_ORIGIN must be an https URL in production (it is used in emailed reset/verify links)');
    } catch { problems.push('CLIENT_ORIGIN must be a valid https URL in production'); }
  }
  if (problems.length) throw new Error(`Invalid configuration:\n - ${problems.join('\n - ')}`);
}

module.exports = validateEnv;
