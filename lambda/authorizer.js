// API Gateway TOKEN authorizer.
// Validates "Authorization: Bearer <jwt>" on protected routes and returns an
// IAM policy that either Allows or Denies the request. Enforcement happens at
// the API Gateway edge, before the main Lambda ever runs.
const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("./secrets");

const JWT_ISSUER = process.env.JWT_ISSUER || "transaction-simulator";

// Build the IAM policy API Gateway expects back from an authorizer.
const buildPolicy = (principalId, effect, resource, context = {}) => ({
  principalId,
  policyDocument: {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "execute-api:Invoke",
        Effect: effect, // "Allow" | "Deny"
        Resource: resource,
      },
    ],
  },
  context, // forwarded to the target Lambda as event.requestContext.authorizer
});

exports.handler = async (event) => {
  const authHeader = event.authorizationToken || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  // No/malformed token -> throwing "Unauthorized" makes API Gateway return 401.
  if (!match) {
    throw new Error("Unauthorized");
  }

  const token = match[1];

  try {
    const secret = await getJwtSecret();
    const decoded = jwt.verify(token, secret, { issuer: JWT_ISSUER });

    // Allow the whole API for this caller. (Could scope Resource to event.methodArn
    // for tighter per-method control; "*" keeps the cached policy reusable.)
    return buildPolicy(
      decoded.sub || "user",
      "Allow",
      "arn:aws:execute-api:*:*:*/*/*/*",
      { role: decoded.role || "user", sub: String(decoded.sub || "") }
    );
  } catch (err) {
    // Expired / bad signature / wrong issuer -> 401 (do not leak details).
    console.error("Authorizer rejected token:", err.name);
    throw new Error("Unauthorized");
  }
};
