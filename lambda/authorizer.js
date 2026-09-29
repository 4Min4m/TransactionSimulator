// API Gateway TOKEN authorizer.
// Validates "Authorization: Bearer <jwt>" on protected routes and returns an
// IAM policy. Enforcement happens at the gateway, before the API Lambda runs.

const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("./secrets");

const JWT_ISSUER = process.env.JWT_ISSUER || "transaction-simulator";

// Allow every method on THIS api + stage only. The policy is cached by API
// Gateway per token (authorizer_result_ttl_in_seconds), so it must cover all
// routes the caller may hit next — but never other APIs or stages.
//   methodArn: arn:aws:execute-api:<region>:<acct>:<apiId>/<stage>/<VERB>/<path>
const stageWideResource = (methodArn) => {
  const [arnPrefix, apiPath] = String(methodArn || "").split(/:(?=[^:]*$)/);
  const [apiId, stage] = (apiPath || "").split("/");
  if (!arnPrefix || !apiId || !stage) throw new Error("Unauthorized");
  return `${arnPrefix}:${apiId}/${stage}/*`;
};

const buildPolicy = (principalId, effect, resource, context = {}) => ({
  principalId,
  policyDocument: {
    Version: "2012-10-17",
    Statement: [{ Action: "execute-api:Invoke", Effect: effect, Resource: resource }],
  },
  context, // exposed to the API Lambda as event.requestContext.authorizer
});

exports.handler = async (event) => {
  const match = (event.authorizationToken || "").match(/^Bearer\s+(\S+)$/i);
  // Throwing exactly "Unauthorized" makes API Gateway answer 401.
  if (!match) throw new Error("Unauthorized");

  // Resolved outside the try: a Secrets Manager outage should surface as an
  // error (and trip the alarms), not masquerade as a bad token.
  const secret = await getJwtSecret();

  let decoded;
  try {
    // Pin the algorithm: never let the token header choose how it is verified.
    decoded = jwt.verify(match[1], secret, { issuer: JWT_ISSUER, algorithms: ["HS256"] });
  } catch (err) {
    console.error(JSON.stringify({ level: "warn", msg: "token rejected", reason: err.name }));
    throw new Error("Unauthorized");
  }

  return buildPolicy(String(decoded.sub || "user"), "Allow", stageWideResource(event.methodArn), {
    role: String(decoded.role || "user"),
    sub: String(decoded.sub || ""),
  });
};

exports._internal = { stageWideResource };
