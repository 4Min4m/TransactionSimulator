// Structured JSON logging with PAN redaction.
//
// Every log line is a single JSON object (CloudWatch Logs Insights can query
// it directly). Any property that could hold a card number is masked before
// serialization, recursively, so a raw PAN can never reach CloudWatch even if
// a caller logs a whole request body.

const { maskCardNumber } = require("./pan");

const PAN_KEYS = new Set(["card_number", "cardNumber", "pan", "primaryAccountNumber"]);

const redact = (value, depth = 0) => {
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = PAN_KEYS.has(k) ? maskCardNumber(v) : redact(v, depth + 1);
  }
  return out;
};

const write = (level, msg, fields) => {
  let line;
  try {
    line = JSON.stringify({ level, msg, ...redact(fields || {}) });
  } catch {
    line = JSON.stringify({ level, msg, note: "unserializable payload" });
  }
  (level === "error" ? console.error : console.log)(line);
};

module.exports = {
  info: (msg, fields) => write("info", msg, fields),
  warn: (msg, fields) => write("warn", msg, fields),
  error: (msg, fields) => write("error", msg, fields),
  redact,
};
