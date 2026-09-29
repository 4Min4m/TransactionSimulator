// Shared test setup. Must be required BEFORE any module under test.
// Uses the in-memory store and the JWT_SECRET env fallback, so the suite
// needs no network, no AWS and no Supabase.
const bcrypt = require("bcryptjs");

Object.assign(process.env, {
  DATA_STORE: "memory",
  JWT_SECRET: "unit-test-secret",
  JWT_ISSUER: "transaction-simulator",
  JWT_EXPIRES_IN: "1h",
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD_HASH: bcrypt.hashSync("password123", 10),
  ALLOWED_ORIGINS: "https://d123.cloudfront.net",
  ALLOWED_MERCHANT_ID: "demo-merchant",
});
delete process.env.SQS_QUEUE_URL;
delete process.env.AWS_LAMBDA_FUNCTION_NAME;

const call = (method, path, body, headers = {}, queryStringParameters = null) =>
  require("../lambda.js").handler({
    httpMethod: method,
    path,
    body: body === undefined || body === null ? null : typeof body === "string" ? body : JSON.stringify(body),
    headers,
    queryStringParameters,
  });

const pay = (overrides = {}) =>
  call("POST", "/api/transactions", {
    merchant_id: "demo-merchant",
    order_id: `order-${Math.random().toString(36).slice(2)}`,
    amount: 25.5,
    card_number: "4111111111111111",
    ...overrides,
  });

module.exports = { call, pay };
