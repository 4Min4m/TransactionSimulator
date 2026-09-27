// Resolves the JWT signing secret.
//
// Priority:
//   1. AWS Secrets Manager, if JWT_SECRET_ARN is set (production path).
//   2. process.env.JWT_SECRET, as a local-dev / test fallback.
//
// The value is cached in module scope so we hit Secrets Manager at most once
// per Lambda execution environment (per cold start), not on every request.

const JWT_SECRET_ARN = process.env.JWT_SECRET_ARN;

let cachedSecret = null;

const fetchFromSecretsManager = async () => {
  // AWS SDK v3 ships with the Lambda Node.js 20 runtime; it is also listed as a
  // dependency so local installs and tests resolve it deterministically.
  const {
    SecretsManagerClient,
    GetSecretValueCommand,
  } = require("@aws-sdk/client-secrets-manager");

  const client = new SecretsManagerClient({});
  const resp = await client.send(
    new GetSecretValueCommand({ SecretId: JWT_SECRET_ARN })
  );

  let value = resp.SecretString;
  // Support both a raw string secret and a JSON secret like {"jwt_secret":"..."}.
  try {
    const parsed = JSON.parse(value);
    value = parsed.jwt_secret || parsed.JWT_SECRET || value;
  } catch {
    // Not JSON: use the raw string as-is.
  }
  return value;
};

const getJwtSecret = async () => {
  if (cachedSecret) return cachedSecret;

  if (JWT_SECRET_ARN) {
    cachedSecret = await fetchFromSecretsManager();
    return cachedSecret;
  }

  if (process.env.JWT_SECRET) {
    cachedSecret = process.env.JWT_SECRET;
    return cachedSecret;
  }

  throw new Error("Neither JWT_SECRET_ARN nor JWT_SECRET is set");
};

module.exports = { getJwtSecret };
