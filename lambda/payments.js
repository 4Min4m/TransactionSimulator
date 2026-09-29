// Payment processing: idempotency -> authorization -> ISO 8583 -> persistence.
//
// Shared by the API Lambda (single transactions) and the batch worker, so the
// rules for authorization, masking and idempotency exist exactly once.

const { authorize, RESPONSE_CODES } = require("./authorization");
const { maskCardNumber } = require("./pan");
const iso = require("./iso8583");
const log = require("./log");

class IdempotencyConflictError extends Error {
  constructor() {
    super("order_id was already used with different transaction details");
    this.name = "IdempotencyConflictError";
  }
}

// PAN as it appears inside a stored ISO message: length preserved,
// only the first 4 and last 4 digits kept.
const maskPanForIso = (pan) => pan.slice(0, 4) + "*".repeat(Math.max(pan.length - 8, 1)) + pan.slice(-4);

const toMinorUnits = (amount) => Math.round(Number(amount) * 100);

// Two requests with the same (merchant_id, order_id) must describe the same
// payment; otherwise a replay would silently return the wrong result.
const sameRequest = (row, { pan, amountMinor, currency }) =>
  toMinorUnits(row.amount) === amountMinor &&
  row.card_number === maskCardNumber(pan) &&
  (row.currency || "USD") === currency;

const storableMessage = ({ mti, fields }) => {
  const masked = { ...fields, 2: maskPanForIso(String(fields[2])) };
  return { mti, raw: iso.pack(mti, masked, { allowMaskedPan: true }), fields: iso.describe(masked) };
};

// One log line per payment. `metric` is matched by CloudWatch metric filters
// (terraform/observability.tf) to chart approvals vs declines.
const logOutcome = ({ replayed, row }) => {
  const approved = row.status === "APPROVED";
  log.info("payment authorized", {
    metric: replayed ? "PAYMENT_REPLAYED" : approved ? "PAYMENT_APPROVED" : "PAYMENT_DECLINED",
    orderId: row.order_id,
    batchId: row.batch_id || undefined,
    responseCode: row.response_code,
    approved,
    replayed,
  });
  return { replayed, row };
};

/**
 * @param {object} store  see store.js
 * @param {{ merchantId: string, orderId: string, pan: string, amountMinor: number,
 *           currency?: string, batchId?: string|null, now?: Date }} input
 * @returns {Promise<{ replayed: boolean, row: object }>}
 */
const processPayment = async (store, input) => {
  const currency = input.currency || "USD";
  const request = { ...input, currency };

  const existing = await store.findTransaction(input.merchantId, input.orderId);
  if (existing) {
    if (!sameRequest(existing, request)) throw new IdempotencyConflictError();
    return logOutcome({ replayed: true, row: existing });
  }

  const started = process.hrtime.bigint();
  const now = input.now || new Date();

  const decision = authorize(request);
  const isoRequest = iso.buildAuthorizationRequest({ ...request, now });
  const isoResponse = iso.buildAuthorizationResponse(isoRequest, decision, now);
  // Pack the real (unmasked) messages to prove they are valid on the wire;
  // only the masked copies below are ever persisted.
  iso.pack(isoRequest.mti, isoRequest.fields);
  iso.pack(isoResponse.mti, isoResponse.fields);

  const row = {
    order_id: input.orderId,
    merchant_id: input.merchantId,
    batch_id: input.batchId || null,
    amount: input.amountMinor / 100,
    currency,
    card_number: maskCardNumber(input.pan),
    card_scheme: decision.scheme,
    type: "PURCHASE",
    status: decision.approved ? "APPROVED" : "DECLINED",
    response_code: decision.responseCode,
    authorization_code: decision.authorizationCode,
    iso8583_message: { request: storableMessage(isoRequest), response: storableMessage(isoResponse) },
    processing_ms: Math.round(Number(process.hrtime.bigint() - started) / 1e3) / 1e3,
    created_at: now.toISOString(),
  };

  const result = await store.insertTransaction(row);
  if (result.inserted) return logOutcome({ replayed: false, row: result.row });

  // Lost a race with a concurrent request for the same order_id: the
  // database kept the first one, so return that (or reject a mismatch).
  if (!sameRequest(result.row, request)) throw new IdempotencyConflictError();
  return logOutcome({ replayed: true, row: result.row });
};

// Shape returned by POST /api/transactions.
const toApiResult = ({ replayed, row }) => ({
  success: row.status === "APPROVED",
  message: row.status === "APPROVED" ? "Transaction approved" : "Transaction declined",
  responseCode: row.response_code,
  responseMessage: RESPONSE_CODES[row.response_code] || "Unknown",
  authorizationCode: row.authorization_code || null,
  idempotentReplay: replayed,
  data: row,
});

module.exports = { processPayment, toApiResult, toMinorUnits, maskPanForIso, IdempotencyConflictError };
