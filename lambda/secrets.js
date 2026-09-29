// Runtime secret resolution.
//
// Each secret is looked up as:
//   1. AWS Secrets Manager, when its `*_ARN` variable is set (deployed path).
//   2. A plain environment variable, as a local-dev / unit-test fallback.
//
// Values are cached per execution environment, so Secrets Manager is called
// at most once per secret per cold start. Plaintext secrets never appear in
// the Lambda configuration itself.

const cache = new Map();
let smClient = null;

const fetchFromSecretsManager = async (secretArn, jsonKeys) => {
  const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
  if (!smClient) smClient = new SecretsManagerClient({});
  const resp = await smClient.send(new GetSecretValueCommand({ SecretId: secretArn }));

  const value = resp.SecretString;
  // Accept either a raw string secret or a JSON document with a known key.
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      for (const key of jsonKeys) if (parsed[key]) return parsed[key];
    }
  } catch {
    // Not JSON: the raw string is the secret.
  }
  return value;
};

const makeResolver = (name, arnVar, jsonKeys) => async () => {
  if (cache.has(name)) return cache.get(name);

  const arn = process.env[arnVar];
  let value;
  if (arn) value = await fetchFromSecretsManager(arn, jsonKeys);
  else if (process.env[name]) value = process.env[name];
  else throw new Error(`Neither ${arnVar} nor ${name} is set`);

  cache.set(name, value);
  return value;
};

const getJwtSecret = makeResolver("JWT_SECRET", "JWT_SECRET_ARN", ["jwt_secret", "JWT_SECRET"]);
const getSupabaseKey = makeResolver("SUPABASE_KEY", "SUPABASE_KEY_SECRET_ARN", ["supabase_key", "SUPABASE_KEY"]);

module.exports = { getJwtSecret, getSupabaseKey };
