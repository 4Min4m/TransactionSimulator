// API Lambda: login, single transactions, async batch enqueue, batch status.
// Routed by API Gateway (REST, AWS_PROXY). Every route except /api/login and
// CORS preflights is protected by the JWT Lambda authorizer at the gateway.

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { getJwtSecret } = require("./secrets");
const { getStore } = require("./store");
const { processPayment, toApiResult, toMinorUnits, IdempotencyConflictError } = require("./payments");
const { digitsOnly } = require("./pan");
const { ISO_CURRENCY } = require("./iso8583");
const log = require("./log");

// --- Configuration ------------------------------------------------------------
const JWT_ISSUER = process.env.JWT_ISSUER || "transaction-simulator";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH; // bcrypt hash, never plaintext

if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {
  throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD_HASH must be set");
}

// The single demo merchant the simulator accepts. It is sent in ISO 8583
// field 42 (card acceptor id, ans 15), so it must fit that field.
const ALLOWED_MERCHANT_ID = process.env.ALLOWED_MERCHANT_ID || "demo-merchant";
if (!/^[\x20-\x7E]{1,15}$/.test(ALLOWED_MERCHANT_ID)) {
  throw new Error("ALLOWED_MERCHANT_ID must be 1-15 printable ASCII characters (ISO 8583 field 42)");
}

// Hash of a value nobody will ever type. An unknown username is checked
// against it so that it costs the same bcrypt work as a known one.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomUUID(), 10);

const MAX_BATCH_TRANSACTIONS = 1000;
const MAX_BATCH_DURATION_SECONDS = 300;
const MAX_AMOUNT = 1_000_000; // request-level sanity cap; issuer limit is lower (see authorization.js)
const ORDER_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;

// Queue consumed by the batch worker. When unset (unit tests / local dev),
// the worker runs in-process instead.
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;
let sqsClient = null;
const getSqsClient = () => {
  if (!sqsClient) {
    const { SQSClient } = require("@aws-sdk/client-sqs");
    sqsClient = new SQSClient({});
  }
  return sqsClient;
};

// --- CORS (allow-list, never "*") ---------------------------------------------
// ALLOWED_ORIGINS is a comma-separated list injected by Terraform.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const resolveAllowedOrigin = (event) => {
  const h = event.headers || {};
  const reqOrigin = h.origin || h.Origin || h.ORIGIN || "";
  if (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) return reqOrigin;
  return ALLOWED_ORIGINS[0] || "null";
};

const buildHeaders = (event, extra = {}) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": resolveAllowedOrigin(event),
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With",
  "Access-Control-Expose-Headers": "Idempotent-Replayed",
  Vary: "Origin",
  ...extra,
});

// --- Response helpers -----------------------------------------------------------
const json = (event, statusCode, body, extraHeaders) => ({
  statusCode,
  headers: buildHeaders(event, extraHeaders),
  body: JSON.stringify(body),
});

// Client-visible validation error (intentional, safe message).
const clientError = (event, message, statusCode = 400) => json(event, statusCode, { error: message });

// Unexpected failure: generic message + traceId for the client, full detail
// only in CloudWatch.
const serverError = (event, error) => {
  const traceId = crypto.randomUUID();
  log.error("unhandled error", {
    traceId,
    path: event.path,
    error: error && error.stack ? error.stack : String(error),
  });
  return json(event, 500, { error: "Internal Server Error", traceId });
};

class BadRequest extends Error {}

const parseBody = (event) => {
  if (!event.body) return {};
  try {
    const body = JSON.parse(event.body);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new BadRequest("Request body must be a JSON object");
  }
};

// A positive amount with at most two decimal places, returned in minor units.
const parseAmount = (value, field) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > MAX_AMOUNT) {
    throw new BadRequest(`${field} must be a positive number no greater than ${MAX_AMOUNT}`);
  }
  const minor = toMinorUnits(value);
  if (Math.abs(minor - value * 100) > 1e-6) {
    throw new BadRequest(`${field} must have at most two decimal places`);
  }
  return minor;
};

// --- Route handlers ---------------------------------------------------------------
const login = async (event) => {
  const { username, password } = parseBody(event);
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return clientError(event, "Username and password are required");
  }
  if (username.length > 128 || password.length > 128) {
    return clientError(event, "Invalid credentials", 401);
  }

  const usernameOk = username.toLowerCase() === ADMIN_USERNAME.toLowerCase();
  // Always run bcrypt, even for an unknown username: short-circuiting would
  // make "wrong username" measurably faster than "wrong password" and leak
  // which usernames exist.
  const passwordOk = await bcrypt.compare(password, usernameOk ? ADMIN_PASSWORD_HASH : DUMMY_PASSWORD_HASH);

  if (!usernameOk || !passwordOk) {
    log.warn("login failed", { sourceIp: event.requestContext?.identity?.sourceIp });
    return clientError(event, "Invalid credentials", 401);
  }

  const token = jwt.sign({ sub: ADMIN_USERNAME, role: "admin" }, await getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: JWT_EXPIRES_IN,
    issuer: JWT_ISSUER,
  });
  return json(event, 200, { message: "Login successful", username: ADMIN_USERNAME, token, expires_in: JWT_EXPIRES_IN });
};

const listTransactions = async (event) => {
  const qs = event.queryStringParameters || {};
  let limit = parseInt(qs.limit, 10);
  let offset = parseInt(qs.offset, 10);
  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) limit = 50;
  if (!Number.isInteger(offset) || offset < 0) offset = 0;

  const items = await getStore().listTransactions(limit, offset);
  return json(event, 200, { items, limit, offset });
};

const createTransaction = async (event) => {
  const body = parseBody(event);
  const { merchant_id, order_id, card_number, currency = "USD" } = body;

  if (merchant_id === undefined || order_id === undefined || card_number === undefined || body.amount === undefined) {
    return clientError(event, "merchant_id, amount, card_number, and order_id are required");
  }
  if (merchant_id !== ALLOWED_MERCHANT_ID) return clientError(event, "Invalid merchant_id");
  if (typeof order_id !== "string" || !ORDER_ID_PATTERN.test(order_id)) {
    return clientError(event, "order_id must be 1-64 characters of [A-Za-z0-9._:-]");
  }
  // Format only: a well-formed PAN that fails the Luhn check is a business
  // decline (response code 14), not a malformed request.
  const pan = typeof card_number === "string" ? digitsOnly(card_number) : "";
  if (typeof card_number !== "string" || !/^[\d\s-]+$/.test(card_number) || !/^\d{12,19}$/.test(pan)) {
    return clientError(event, "card_number must contain 12-19 digits");
  }
  if (!Object.prototype.hasOwnProperty.call(ISO_CURRENCY, currency)) {
    return clientError(event, `currency must be one of ${Object.keys(ISO_CURRENCY).join(", ")}`);
  }
  const amountMinor = parseAmount(body.amount, "amount");

  try {
    const outcome = await processPayment(getStore(), {
      merchantId: merchant_id,
      orderId: order_id,
      pan,
      amountMinor,
      currency,
    });
    return json(event, 200, toApiResult(outcome), outcome.replayed ? { "Idempotent-Replayed": "true" } : {});
  } catch (err) {
    if (err instanceof IdempotencyConflictError) return clientError(event, err.message, 409);
    throw err;
  }
};

const startBatch = async (event) => {
  const body = parseBody(event);
  const total = Number(body.total_transactions);
  const duration = Number(body.duration_seconds);
  const merchantId = body.merchant_id === undefined ? ALLOWED_MERCHANT_ID : body.merchant_id;

  if (!Number.isInteger(total) || total <= 0 || total > MAX_BATCH_TRANSACTIONS) {
    return clientError(event, `total_transactions must be an integer between 1 and ${MAX_BATCH_TRANSACTIONS}`);
  }
  // Bounded so a batch can never outlive the worker's Lambda timeout.
  if (!Number.isFinite(duration) || duration < 0 || duration > MAX_BATCH_DURATION_SECONDS) {
    return clientError(event, `duration_seconds must be between 0 and ${MAX_BATCH_DURATION_SECONDS}`);
  }
  if (merchantId !== ALLOWED_MERCHANT_ID) return clientError(event, "Invalid merchant_id");
  const totalAmountMinor = parseAmount(body.total_amount, "total_amount");
  if (totalAmountMinor < total) {
    return clientError(event, "total_amount must allow at least 0.01 per transaction");
  }

  const batchId = crypto.randomUUID();
  await getStore().createBatch({
    id: batchId,
    status: "queued",
    merchant_id: merchantId,
    total_transactions: total,
    total_amount: totalAmountMinor / 100,
    success_count: 0,
    failure_count: 0,
    created_at: new Date().toISOString(),
  });

  const message = {
    batch_id: batchId,
    total_transactions: total,
    total_amount_minor: totalAmountMinor,
    duration_seconds: duration,
    merchant_id: merchantId,
  };

  if (SQS_QUEUE_URL) {
    const { SendMessageCommand } = require("@aws-sdk/client-sqs");
    await getSqsClient().send(new SendMessageCommand({ QueueUrl: SQS_QUEUE_URL, MessageBody: JSON.stringify(message) }));
  } else {
    // Local dev / unit tests: no queue, run the worker in-process.
    const { handler: workerHandler } = require("./batch-worker");
    await workerHandler({ Records: [{ messageId: "local", body: JSON.stringify(message) }] });
  }

  log.info("batch queued", { batchId, total });
  return json(event, 202, { batch_id: batchId, status: "queued" });
};

const getBatch = async (event, batchId) => {
  const batch = await getStore().getBatch(batchId);
  if (!batch) return clientError(event, "Batch not found", 404);
  return json(event, 200, batch);
};

// --- Router -------------------------------------------------------------------------
exports.handler = async (event) => {
  const path = event.path || "";
  const method = event.httpMethod;

  if (method === "OPTIONS") return json(event, 200, {});

  try {
    if (path === "/api/login" && method === "POST") return await login(event);
    if (path === "/api/transactions" && method === "GET") return await listTransactions(event);
    if (path === "/api/transactions" && method === "POST") return await createTransaction(event);
    if (path === "/api/process-batch" && method === "POST") return await startBatch(event);

    const batchMatch = path.match(/^\/api\/batches\/([A-Za-z0-9-]{1,64})$/);
    if (batchMatch && method === "GET") return await getBatch(event, batchMatch[1]);

    return clientError(event, "Not found", 404);
  } catch (err) {
    if (err instanceof BadRequest) return clientError(event, err.message);
    return serverError(event, err);
  }
};
