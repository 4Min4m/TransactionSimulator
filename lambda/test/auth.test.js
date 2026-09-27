// Auth + handler tests. Run with: npm test  (uses Node's built-in test runner)
const { test } = require("node:test");
const assert = require("node:assert");
const bcrypt = require("bcryptjs");

// Minimal env so the modules initialise. Uses the JWT_SECRET fallback path
// (no JWT_SECRET_ARN), so Secrets Manager is never contacted in tests. No
// SQS_QUEUE_URL is set either, so process-batch runs the worker in-process
// (see lambda.js) instead of needing a real queue.
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "test-key";
process.env.JWT_SECRET = "unit-test-secret";
process.env.JWT_ISSUER = "transaction-simulator";
process.env.JWT_EXPIRES_IN = "1h";
process.env.ADMIN_USERNAME = "admin";
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("password123", 10);
process.env.ALLOWED_ORIGINS = "https://d123.cloudfront.net";
process.env.ALLOWED_MERCHANT_ID = "demo-merchant";

const { handler } = require("../lambda.js");
const { handler: authHandler } = require("../authorizer.js");
const { maskCardNumber } = require("../shared.js");

const call = (method, path, body, headers = {}, queryStringParameters = null) =>
  handler({
    httpMethod: method,
    path,
    body: body ? JSON.stringify(body) : null,
    headers,
    queryStringParameters,
  });

test("login rejects wrong password with 401 and no token", async () => {
  const r = await call("POST", "/api/login", { username: "admin", password: "nope" });
  assert.strictEqual(r.statusCode, 401);
  assert.ok(!JSON.parse(r.body).token);
});

test("login returns a JWT on valid credentials", async () => {
  const r = await call("POST", "/api/login", { username: "admin", password: "password123" });
  assert.strictEqual(r.statusCode, 200);
  const token = JSON.parse(r.body).token;
  assert.strictEqual(typeof token, "string");
  assert.strictEqual(token.split(".").length, 3);
});

test("wrong-username and wrong-password responses take comparable time (no user enumeration)", async () => {
  // Regression test for the timing side-channel: previously a wrong
  // username short-circuited before ever calling bcrypt.compare, making it
  // measurably faster than a wrong password for a real username. Both
  // paths must now run bcrypt.compare exactly once.
  const timeIt = async (username, password) => {
    const start = process.hrtime.bigint();
    await call("POST", "/api/login", { username, password });
    return Number(process.hrtime.bigint() - start) / 1e6; // ms
  };

  const wrongUsernameMs = await timeIt("not-admin", "irrelevant");
  const wrongPasswordMs = await timeIt("admin", "irrelevant");

  // bcrypt cost dominates both paths; they should be within the same order
  // of magnitude rather than one being near-instant. A generous ratio
  // avoids CI flakiness while still catching a reintroduced short-circuit.
  const ratio = Math.max(wrongUsernameMs, wrongPasswordMs) / Math.min(wrongUsernameMs, wrongPasswordMs);
  assert.ok(ratio < 5, `expected comparable timing, got ratio ${ratio.toFixed(2)}`);
});

test("CORS origin is echoed, never wildcard", async () => {
  const r = await call("OPTIONS", "/api/transactions", null, {
    origin: "https://d123.cloudfront.net",
  });
  assert.strictEqual(r.headers["Access-Control-Allow-Origin"], "https://d123.cloudfront.net");
});

test("authorizer allows a valid token and forwards role", async () => {
  const login = await call("POST", "/api/login", { username: "admin", password: "password123" });
  const token = JSON.parse(login.body).token;
  const a = await authHandler({ authorizationToken: "Bearer " + token });
  assert.strictEqual(a.policyDocument.Statement[0].Effect, "Allow");
  assert.strictEqual(a.context.role, "admin");
});

test("authorizer denies a missing token", async () => {
  await assert.rejects(() => authHandler({ authorizationToken: "" }), /Unauthorized/);
});

test("authorizer denies a tampered token", async () => {
  const login = await call("POST", "/api/login", { username: "admin", password: "password123" });
  const token = JSON.parse(login.body).token;
  await assert.rejects(
    () => authHandler({ authorizationToken: "Bearer " + token.slice(0, -2) + "xx" }),
    /Unauthorized/
  );
});

test("maskCardNumber keeps only first4/last4 and masks short input fully", () => {
  assert.strictEqual(maskCardNumber("4111111111111111"), "4111-****-****-1111");
  assert.strictEqual(maskCardNumber("123"), "****");
  assert.strictEqual(maskCardNumber(undefined), "****");
});

test("single transaction rejects an unknown merchant_id", async () => {
  const r = await call("POST", "/api/transactions", {
    merchant_id: "not-the-demo-merchant",
    amount: 10,
    card_number: "4111111111111111",
    order_id: "o1",
  });
  assert.strictEqual(r.statusCode, 400);
});

test("single transaction rejects a non-positive amount", async () => {
  const r = await call("POST", "/api/transactions", {
    merchant_id: "demo-merchant",
    amount: -5,
    card_number: "4111111111111111",
    order_id: "o2",
  });
  assert.strictEqual(r.statusCode, 400);
});

test("process-batch rejects 0 transactions (no divide-by-zero)", async () => {
  const r = await call("POST", "/api/process-batch", {
    total_transactions: 0,
    total_amount: 10,
    duration_seconds: 1,
    merchant_id: "demo-merchant",
  });
  assert.strictEqual(r.statusCode, 400);
});

test("process-batch rejects a duration over the cap", async () => {
  const r = await call("POST", "/api/process-batch", {
    total_transactions: 5,
    total_amount: 10,
    duration_seconds: 9999,
    merchant_id: "demo-merchant",
  });
  assert.strictEqual(r.statusCode, 400);
});

test("process-batch accepts a valid request and returns a batch_id (202), or a controlled 500 if Supabase is unreachable in this env", async () => {
  // With a real queue + Supabase, the request is validated, a `batches` row
  // is written, the job is enqueued, and the handler returns 202. In this
  // unit-test env there is NO SQS_QUEUE_URL and SUPABASE_URL is a fake host,
  // so the very first Supabase write (createBatchRecord) fails and the
  // handler returns a controlled 500 with a traceId — never an unhandled
  // crash. We accept either and, when it's 202, assert the response shape.
  // (Same tolerance as the GET /api/batches test below.)
  const r = await call("POST", "/api/process-batch", {
    total_transactions: 1,
    total_amount: 10,
    duration_seconds: 0,
    merchant_id: "demo-merchant",
  });
  assert.ok([202, 500].includes(r.statusCode), `unexpected status ${r.statusCode}`);
  if (r.statusCode === 202) {
    const body = JSON.parse(r.body);
    assert.strictEqual(body.status, "queued");
    assert.strictEqual(typeof body.batch_id, "string");
  } else {
    // Must still be our safe error shape, not a leaked stack trace.
    const body = JSON.parse(r.body);
    assert.strictEqual(body.error, "Internal Server Error");
    assert.strictEqual(typeof body.traceId, "string");
  }
});

test("GET /api/batches/:id with an unknown id returns 404 (or a controlled 500 if Supabase is unreachable in this env)", async () => {
  const r = await call("GET", "/api/batches/does-not-exist");
  assert.ok([404, 500].includes(r.statusCode));
});
