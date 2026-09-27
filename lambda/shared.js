// Shared domain + persistence helpers used by BOTH lambda.js (the API) and
// batch-worker.js (the async SQS consumer). Keeping this in one place means
// PAN masking, the ISO 8583 shape, and Supabase access are defined exactly
// once instead of drifting between two Lambdas.

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_KEY must be provided in environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- PAN masking -----------------------------------------------------------
// Mask a PAN to the form 1234-****-****-5678 (first 4 + last 4 kept).
// Any non-digit is stripped first. Short/invalid inputs are fully masked.
const maskCardNumber = (rawPan) => {
  if (rawPan === undefined || rawPan === null) return "****";
  const digits = String(rawPan).replace(/\D/g, "");
  if (digits.length < 8) return "****"; // too short to expose anything safely
  const first4 = digits.slice(0, 4);
  const last4 = digits.slice(-4);
  return `${first4}-****-****-${last4}`;
};

// Return a copy of a transaction-like object with the PAN masked. Used
// before persisting to Supabase AND before any logging.
const withMaskedPan = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  const clone = { ...obj };
  if ("card_number" in clone) clone.card_number = maskCardNumber(clone.card_number);
  return clone;
};

// Safe logging: never let a raw PAN reach CloudWatch.
const safeLog = (label, payload) => {
  try {
    console.log(label, JSON.stringify(withMaskedPan(payload)));
  } catch {
    console.log(label, "[unserializable payload]");
  }
};

// --- ISO 8583 -----------------------------------------------------------
const generateISO8583Message = (transaction, responseCode) => {
  const now = new Date();
  return {
    mti: "0110",
    primaryAccountNumber: maskCardNumber(transaction.card_number),
    processingCode: "000000",
    amount: transaction.amount,
    transmissionDateTime: now.toISOString().replace(/[-:T.]/g, "").slice(0, 14),
    systemTraceNumber: Math.floor(Math.random() * (999999 - 100000 + 1) + 100000).toString(),
    localTransactionTime: now.toTimeString().slice(0, 8),
    localTransactionDate: now.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
    merchantType: "5999",
    responseCode: responseCode,
    terminalId: "TERM001",
    merchantId: transaction.merchant_id,
  };
};

// --- Single transaction ----------------------------------------------------
// Simulates authorization (90% approval), masks the PAN, and persists the
// result. Used both by the synchronous single-transaction endpoint and by
// the batch worker (once per simulated transaction in a batch).
const processSingleTransaction = async (transaction) => {
  const isApproved = Math.random() < 0.9; // 90%
  const responseCode = isApproved ? "00" : "05";

  const iso8583Message = generateISO8583Message(transaction, responseCode);

  const transactionData = {
    ...transaction,
    card_number: maskCardNumber(transaction.card_number),
    type: "PURCHASE",
    status: isApproved ? "APPROVED" : "DECLINED",
    iso8583_message: iso8583Message,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("transactions").insert([transactionData]);
  if (error) throw error;

  return {
    success: isApproved,
    message: isApproved ? "Transaction approved" : "Transaction declined",
    data: {
      ...transactionData,
      responseCode: responseCode,
      processed_at: new Date().toISOString(),
    },
  };
};

// --- Batch bookkeeping (backs GET /api/batches/:id) ------------------------
const createBatchRecord = async (batchId, meta) => {
  const { error } = await supabase.from("batches").insert([
    {
      id: batchId,
      status: "queued",
      total_transactions: meta.total_transactions,
      success_count: 0,
      failure_count: 0,
      created_at: new Date().toISOString(),
    },
  ]);
  if (error) throw error;
};

const updateBatchRecord = async (batchId, patch) => {
  const { error } = await supabase
    .from("batches")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", batchId);
  if (error) throw error;
};

const getBatchRecord = async (batchId) => {
  const { data, error } = await supabase.from("batches").select("*").eq("id", batchId).maybeSingle();
  if (error) throw error;
  return data;
};

module.exports = {
  supabase,
  maskCardNumber,
  withMaskedPan,
  safeLog,
  generateISO8583Message,
  processSingleTransaction,
  createBatchRecord,
  updateBatchRecord,
  getBatchRecord,
};
