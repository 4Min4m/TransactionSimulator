const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { getJwtSecret } = require("./secrets");
const {
  safeLog,
  processSingleTransaction,
  createBatchRecord,
  getBatchRecord,
  supabase,
} = require("./shared");

// --- Auth config (all injected via environment / Secrets Manager) --------
const JWT_ISSUER = process.env.JWT_ISSUER || "transaction-simulator";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH; // bcrypt hash

if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {
  throw new Error(
    "ADMIN_USERNAME and ADMIN_PASSWORD_HASH must be provided in environment variables"
  );
}

// A hash of a value nobody will ever type, used ONLY so that an unknown
// username still pays the same bcrypt cost as a known one (see login below).
// Computed once at module load, not per-request.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomUUID(), 10);

// The simulator only accepts one demo merchant id. Configurable via env so
// it isn't a hardcoded, unexplained magic string in the code (was previously
// a leftover value with no relation to this project).
const ALLOWED_MERCHANT_ID = process.env.ALLOWED_MERCHANT_ID || "demo-merchant";

// SQS queue that the batch worker consumes. When unset (local dev / unit
// tests, where no real AWS infrastructure exists), process-batch falls back
// to invoking the worker's handler in-process instead of enqueueing.
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;
let _sqsClient = null;
const getSqsClient = () => {
  if (!_sqsClient) {
    const { SQSClient } = require("@aws-sdk/client-sqs");
    _sqsClient = new SQSClient({});
  }
  return _sqsClient;
};

// --- CORS: allow-list driven, never "*" ---------------------------------
// ALLOWED_ORIGINS is a comma-separated list injected by Terraform, e.g.
//   "https://d123.cloudfront.net,http://localhost:5173"
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Resolve which origin to echo back for a given request.
// - If the request Origin is in the allow-list -> echo it.
// - Otherwise -> fall back to the first configured origin (the CloudFront domain).
//   We never return "*".
const resolveAllowedOrigin = (event) => {
  const reqOrigin =
    (event.headers &&
      (event.headers.origin || event.headers.Origin || event.headers.ORIGIN)) ||
    "";
  if (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) return reqOrigin;
  return ALLOWED_ORIGINS[0] || "null";
};

const buildHeaders = (event) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": resolveAllowedOrigin(event),
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With",
  "Vary": "Origin",
});

// --- Response helpers ------------------------------------------------------
// Uniform error response: generic message to the client + traceId, full
// detail only in CloudWatch. Never leak error.message to the caller.
const errorResponse = (event, error, statusCode = 500) => {
  const traceId = crypto.randomUUID();
  console.error(`[traceId=${traceId}]`, error && error.stack ? error.stack : error);
  return {
    statusCode,
    headers: buildHeaders(event),
    body: JSON.stringify({ error: "Internal Server Error", traceId }),
  };
};

// A client-visible validation error (safe, intentional message - not a leak).
const validationResponse = (event, message, statusCode = 400) => ({
  statusCode,
  headers: buildHeaders(event),
  body: JSON.stringify({ error: message }),
});

// Fetch a page of transactions for TransactionHistory / Chart (GET).
const getTransactionsPage = async (limit, offset) => {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data || [];
};

// --- Handler -------------------------------------------------------------
exports.handler = async (event) => {
  const headers = buildHeaders(event);

  const path = event.path || "";
  const httpMethod = event.httpMethod;

  console.log(`Processing ${httpMethod} request to ${path}`);

  // CORS preflight
  if (httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: JSON.stringify({}) };
  }

  // POST /api/login  (public: issues a JWT on valid credentials)
  if (path === "/api/login" && httpMethod === "POST") {
    try {
      const requestBody = event.body ? JSON.parse(event.body) : {};
      const { username, password } = requestBody;

      console.log(`Login attempt for user: ${username}`);

      if (!username || !password) {
        return validationResponse(event, "Username and password are required");
      }

      const usernameOk = username.toLowerCase() === ADMIN_USERNAME.toLowerCase();

      // IMPORTANT: always run bcrypt.compare, even for an unknown username
      // (against a dummy hash). If we short-circuit to `false` when the
      // username doesn't match, a wrong-username response returns much
      // faster than a wrong-password response, letting an attacker
      // enumerate valid usernames purely from response timing.
      const hashToCheck = usernameOk ? ADMIN_PASSWORD_HASH : DUMMY_PASSWORD_HASH;
      const passwordOk = await bcrypt.compare(password, hashToCheck);

      if (!usernameOk || !passwordOk) {
        return validationResponse(event, "Invalid credentials", 401);
      }

      const jwtSecret = await getJwtSecret();
      const token = jwt.sign(
        { sub: ADMIN_USERNAME, role: "admin" },
        jwtSecret,
        { expiresIn: JWT_EXPIRES_IN, issuer: JWT_ISSUER }
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: "Login successful",
          username: ADMIN_USERNAME,
          token,
          expires_in: JWT_EXPIRES_IN,
        }),
      };
    } catch (error) {
      return errorResponse(event, error, 400);
    }
  }

  // GET /api/transactions?limit=&offset=  (paginated list)
  if (path === "/api/transactions" && httpMethod === "GET") {
    try {
      const qs = event.queryStringParameters || {};
      let limit = parseInt(qs.limit, 10);
      let offset = parseInt(qs.offset, 10);
      if (!Number.isInteger(limit) || limit <= 0 || limit > 200) limit = 50;
      if (!Number.isInteger(offset) || offset < 0) offset = 0;

      const items = await getTransactionsPage(limit, offset);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ items, limit, offset }),
      };
    } catch (error) {
      return errorResponse(event, error);
    }
  }

  // POST /api/transactions  (single transaction)
  if (path === "/api/transactions" && httpMethod === "POST") {
    try {
      const requestBody = event.body ? JSON.parse(event.body) : {};
      const { merchant_id, amount, card_number, order_id } = requestBody;

      safeLog("Received transaction request:", requestBody);

      if (!merchant_id || !amount || !card_number || !order_id) {
        return validationResponse(
          event,
          "merchant_id, amount, card_number, and order_id are required"
        );
      }
      if (merchant_id !== ALLOWED_MERCHANT_ID) {
        return validationResponse(event, "Invalid merchant_id");
      }
      if (typeof amount !== "number" || amount <= 0) {
        return validationResponse(event, "amount must be a positive number");
      }

      const result = await processSingleTransaction(requestBody);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    } catch (error) {
      return errorResponse(event, error);
    }
  }

  // POST /api/process-batch  -> enqueues async work, returns immediately.
  if (path === "/api/process-batch" && httpMethod === "POST") {
    try {
      const requestBody = event.body ? JSON.parse(event.body) : {};

      const total = Number(requestBody.total_transactions);
      const duration = Number(requestBody.duration_seconds);
      const totalAmount = Number(requestBody.total_amount);

      if (!Number.isInteger(total) || total <= 0 || total > 1000) {
        return validationResponse(
          event,
          "total_transactions must be an integer between 1 and 1000"
        );
      }
      // Cap duration so a single batch can never run long enough to be a
      // realistic timeout/cost risk for the worker (also see the worker's
      // own Lambda timeout in terraform/batch-worker.tf).
      if (!Number.isFinite(duration) || duration < 0 || duration > 300) {
        return validationResponse(event, "duration_seconds must be between 0 and 300");
      }
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        return validationResponse(event, "total_amount must be a positive number");
      }

      const batchId = crypto.randomUUID();
      await createBatchRecord(batchId, { total_transactions: total });

      const message = {
        batch_id: batchId,
        total_transactions: total,
        total_amount: totalAmount,
        duration_seconds: duration,
        merchant_id: requestBody.merchant_id || ALLOWED_MERCHANT_ID,
      };

      if (SQS_QUEUE_URL) {
        const { SendMessageCommand } = require("@aws-sdk/client-sqs");
        await getSqsClient().send(
          new SendMessageCommand({
            QueueUrl: SQS_QUEUE_URL,
            MessageBody: JSON.stringify(message),
          })
        );
      } else {
        // Local dev / unit tests: no real queue configured. Run the worker
        // in-process so `npm test` and `npm run dev` need no AWS access.
        const { handler: workerHandler } = require("./batch-worker");
        await workerHandler({ Records: [{ body: JSON.stringify(message) }] });
      }

      return {
        statusCode: 202,
        headers,
        body: JSON.stringify({ batch_id: batchId, status: "queued" }),
      };
    } catch (error) {
      return errorResponse(event, error);
    }
  }

  // GET /api/batches/{id}  (poll batch progress/result)
  const batchMatch = path.match(/^\/api\/batches\/([^/]+)$/);
  if (batchMatch && httpMethod === "GET") {
    try {
      const batch = await getBatchRecord(batchMatch[1]);
      if (!batch) return validationResponse(event, "Batch not found", 404);
      return { statusCode: 200, headers, body: JSON.stringify(batch) };
    } catch (error) {
      return errorResponse(event, error);
    }
  }

  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ error: "Not found", path, method: httpMethod }),
  };
};
