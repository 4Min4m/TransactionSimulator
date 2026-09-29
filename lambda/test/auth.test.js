// Login, JWT issuing, the Lambda authorizer, and CORS.
const { call } = require("./helpers");
const { test } = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");
const { handler: authorize } = require("../authorizer.js");

const METHOD_ARN = "arn:aws:execute-api:us-east-1:123456789012:abc123/prod/GET/api/transactions";

const loginToken = async () =>
  JSON.parse((await call("POST", "/api/login", { username: "admin", password: "password123" })).body).token;

test("login rejects a wrong password with 401 and no token", async () => {
  const r = await call("POST", "/api/login", { username: "admin", password: "nope" });
  assert.strictEqual(r.statusCode, 401);
  assert.ok(!JSON.parse(r.body).token);
});

test("login rejects a missing body field with 400", async () => {
  assert.strictEqual((await call("POST", "/api/login", {})).statusCode, 400);
});

test("login rejects non-string credentials with 400 instead of crashing", async () => {
  assert.strictEqual((await call("POST", "/api/login", { username: 123, password: ["x"] })).statusCode, 400);
});

test("malformed JSON is a 400, not a 500", async () => {
  assert.strictEqual((await call("POST", "/api/login", "{not json")).statusCode, 400);
});

test("login returns an HS256 JWT on valid credentials", async () => {
  const token = await loginToken();
  assert.strictEqual(jwt.decode(token, { complete: true }).header.alg, "HS256");
});

test("wrong-username and wrong-password take comparable time (no user enumeration)", async () => {
  const timeIt = async (username) => {
    const start = process.hrtime.bigint();
    await call("POST", "/api/login", { username, password: "irrelevant" });
    return Number(process.hrtime.bigint() - start) / 1e6;
  };
  const a = await timeIt("not-admin");
  const b = await timeIt("admin");
  const ratio = Math.max(a, b) / Math.min(a, b);
  assert.ok(ratio < 5, `expected comparable timing, got ratio ${ratio.toFixed(2)}`);
});

test("CORS echoes an allow-listed origin and never returns a wildcard", async () => {
  const ok = await call("OPTIONS", "/api/transactions", null, { origin: "https://d123.cloudfront.net" });
  assert.strictEqual(ok.headers["Access-Control-Allow-Origin"], "https://d123.cloudfront.net");
  const evil = await call("OPTIONS", "/api/transactions", null, { origin: "https://evil.example" });
  assert.strictEqual(evil.headers["Access-Control-Allow-Origin"], "https://d123.cloudfront.net");
});

test("authorizer allows a valid token, scoped to this API stage only", async () => {
  const policy = await authorize({ authorizationToken: `Bearer ${await loginToken()}`, methodArn: METHOD_ARN });
  const stmt = policy.policyDocument.Statement[0];
  assert.strictEqual(stmt.Effect, "Allow");
  assert.strictEqual(stmt.Resource, "arn:aws:execute-api:us-east-1:123456789012:abc123/prod/*");
  assert.strictEqual(policy.context.role, "admin");
});

test("authorizer rejects a missing token", async () => {
  await assert.rejects(() => authorize({ authorizationToken: "", methodArn: METHOD_ARN }), /Unauthorized/);
});

test("authorizer rejects a tampered token", async () => {
  const token = await loginToken();
  await assert.rejects(
    () => authorize({ authorizationToken: `Bearer ${token.slice(0, -2)}xx`, methodArn: METHOD_ARN }),
    /Unauthorized/
  );
});

test("authorizer rejects an unsigned (alg=none) token", async () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "admin", role: "admin", iss: "transaction-simulator" })}.`;
  await assert.rejects(() => authorize({ authorizationToken: `Bearer ${none}`, methodArn: METHOD_ARN }), /Unauthorized/);
});

test("authorizer rejects a token from a different issuer", async () => {
  const token = jwt.sign({ sub: "admin" }, "unit-test-secret", { issuer: "someone-else", algorithm: "HS256" });
  await assert.rejects(() => authorize({ authorizationToken: `Bearer ${token}`, methodArn: METHOD_ARN }), /Unauthorized/);
});

test("unknown routes return 404", async () => {
  assert.strictEqual((await call("GET", "/api/nope")).statusCode, 404);
});
