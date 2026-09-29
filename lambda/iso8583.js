// Minimal ISO 8583:1987 codec (ASCII encoding, primary bitmap only).
//
// Wire format produced by `pack`:
//
//   MTI (4 chars) | primary bitmap (16 hex chars = 64 bits) | data elements
//
// Data elements are written in ascending field order. Fixed-length numeric
// fields are left-padded with zeros, fixed-length alphanumeric fields are
// right-padded with spaces, and LLVAR fields carry a 2-digit length prefix.
// Only the fields the simulator actually uses are defined; packing an
// undefined field is an error rather than a silent guess.

const crypto = require("crypto");

const FIELD_SPECS = Object.freeze({
  2: { name: "primaryAccountNumber", type: "n", format: "LLVAR", max: 19 },
  3: { name: "processingCode", type: "n", format: "FIXED", length: 6 },
  4: { name: "amountTransaction", type: "n", format: "FIXED", length: 12 },
  7: { name: "transmissionDateTime", type: "n", format: "FIXED", length: 10 },
  11: { name: "systemTraceAuditNumber", type: "n", format: "FIXED", length: 6 },
  12: { name: "localTransactionTime", type: "n", format: "FIXED", length: 6 },
  13: { name: "localTransactionDate", type: "n", format: "FIXED", length: 4 },
  18: { name: "merchantType", type: "n", format: "FIXED", length: 4 },
  22: { name: "posEntryMode", type: "n", format: "FIXED", length: 3 },
  25: { name: "posConditionCode", type: "n", format: "FIXED", length: 2 },
  37: { name: "retrievalReferenceNumber", type: "an", format: "FIXED", length: 12 },
  38: { name: "authorizationIdResponse", type: "an", format: "FIXED", length: 6 },
  39: { name: "responseCode", type: "an", format: "FIXED", length: 2 },
  41: { name: "cardAcceptorTerminalId", type: "ans", format: "FIXED", length: 8 },
  42: { name: "cardAcceptorIdCode", type: "ans", format: "FIXED", length: 15 },
  49: { name: "currencyCodeTransaction", type: "n", format: "FIXED", length: 3 },
});

const CHARSETS = {
  n: /^\d*$/,
  an: /^[A-Za-z0-9]*$/,
  ans: /^[\x20-\x7E]*$/, // printable ASCII
};

// A masked PAN (e.g. 4111********1111) is the only non-numeric value allowed
// in field 2, and only when explicitly packing a message for storage/logs.
const MASKED_PAN = /^\d{4}\*+\d{4}$/;

class Iso8583Error extends Error {}

const encodeField = (id, raw, { allowMaskedPan = false } = {}) => {
  const spec = FIELD_SPECS[id];
  if (!spec) throw new Iso8583Error(`field ${id} is not defined`);
  const value = String(raw);

  const charsetOk =
    CHARSETS[spec.type].test(value) || (id === 2 && allowMaskedPan && MASKED_PAN.test(value));
  if (!charsetOk) throw new Iso8583Error(`field ${id} (${spec.name}) has invalid characters`);

  if (spec.format === "LLVAR") {
    if (value.length > spec.max) throw new Iso8583Error(`field ${id} exceeds ${spec.max} chars`);
    return String(value.length).padStart(2, "0") + value;
  }
  if (value.length > spec.length) {
    throw new Iso8583Error(`field ${id} (${spec.name}) exceeds ${spec.length} chars`);
  }
  return spec.type === "n" ? value.padStart(spec.length, "0") : value.padEnd(spec.length, " ");
};

const buildBitmap = (fieldIds) => {
  let bits = 0n;
  for (const id of fieldIds) {
    if (id < 2 || id > 64) throw new Iso8583Error(`field ${id} needs a secondary bitmap`);
    bits |= 1n << BigInt(64 - id);
  }
  return bits.toString(16).toUpperCase().padStart(16, "0");
};

const parseBitmap = (hex) => {
  if (!/^[0-9A-Fa-f]{16}$/.test(hex)) throw new Iso8583Error("invalid primary bitmap");
  const bits = BigInt(`0x${hex}`);
  const ids = [];
  for (let id = 1; id <= 64; id++) {
    if (bits & (1n << BigInt(64 - id))) ids.push(id);
  }
  if (ids.includes(1)) throw new Iso8583Error("secondary bitmap is not supported");
  return ids;
};

/**
 * @param {string} mti  4-digit message type indicator, e.g. "0100".
 * @param {Record<number, string|number>} fields  data elements keyed by field number.
 */
const pack = (mti, fields, options) => {
  if (!/^\d{4}$/.test(mti)) throw new Iso8583Error("MTI must be 4 digits");
  const ids = Object.keys(fields)
    .map(Number)
    .sort((a, b) => a - b);
  return mti + buildBitmap(ids) + ids.map((id) => encodeField(id, fields[id], options)).join("");
};

const unpack = (message) => {
  const mti = message.slice(0, 4);
  if (!/^\d{4}$/.test(mti)) throw new Iso8583Error("invalid MTI");
  const ids = parseBitmap(message.slice(4, 20));

  let pos = 20;
  const fields = {};
  for (const id of ids) {
    const spec = FIELD_SPECS[id];
    if (!spec) throw new Iso8583Error(`field ${id} is not defined`);
    let len = spec.length;
    if (spec.format === "LLVAR") {
      len = Number(message.slice(pos, pos + 2));
      pos += 2;
    }
    const value = message.slice(pos, pos + len);
    if (value.length !== len) throw new Iso8583Error(`message truncated in field ${id}`);
    fields[id] = spec.type === "n" || spec.format === "LLVAR" ? value : value.trimEnd();
    pos += len;
  }
  if (pos !== message.length) throw new Iso8583Error("trailing data after last field");
  return { mti, fields };
};

// Human-readable view: { "2 primaryAccountNumber": "...", ... }
const describe = (fields) =>
  Object.fromEntries(
    Object.entries(fields).map(([id, v]) => [`${id} ${FIELD_SPECS[id].name}`, v])
  );

// --- Authorization request/response builders -------------------------------

const pad2 = (n) => String(n).padStart(2, "0");

const timestamps = (now) => ({
  // Field 7 is GMT; fields 12/13 are "local" — the simulator's terminal is UTC.
  transmission: `${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}${pad2(now.getUTCSeconds())}`,
  time: `${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}${pad2(now.getUTCSeconds())}`,
  date: `${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}`,
});

// RRN convention: YDDD (last digit of year + julian day) + HH + STAN.
const retrievalReferenceNumber = (now, stan) => {
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const julian = String(Math.floor((now.getTime() - start) / 86_400_000)).padStart(3, "0");
  return `${String(now.getUTCFullYear()).slice(-1)}${julian}${pad2(now.getUTCHours())}${stan}`;
};

const ISO_CURRENCY = Object.freeze({ USD: "840", EUR: "978", GBP: "826" });

/**
 * Build a 0100 authorization request.
 * @param {{ pan: string, amountMinor: number, merchantId: string, currency?: string,
 *           terminalId?: string, mcc?: string, now?: Date, stan?: string }} tx
 */
const buildAuthorizationRequest = (tx) => {
  const now = tx.now || new Date();
  const stan = tx.stan || String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const ts = timestamps(now);
  return {
    mti: "0100",
    fields: {
      2: tx.pan,
      3: "000000", // purchase, default accounts
      4: String(tx.amountMinor),
      7: ts.transmission,
      11: stan,
      12: ts.time,
      13: ts.date,
      18: tx.mcc || "5999", // miscellaneous retail
      22: "010", // PAN manually entered, no PIN capability
      25: "59", // e-commerce / card-not-present
      41: tx.terminalId || "TERM0001",
      42: tx.merchantId,
      49: ISO_CURRENCY[tx.currency || "USD"],
    },
  };
};

/** Build the matching 0110 response by echoing the request and adding 37/38/39. */
const buildAuthorizationResponse = (request, decision, now = new Date()) => {
  const fields = { ...request.fields };
  fields[37] = retrievalReferenceNumber(now, request.fields[11]);
  if (decision.authorizationCode) fields[38] = decision.authorizationCode;
  fields[39] = decision.responseCode;
  return { mti: "0110", fields };
};

module.exports = {
  FIELD_SPECS,
  ISO_CURRENCY,
  Iso8583Error,
  pack,
  unpack,
  describe,
  buildBitmap,
  parseBitmap,
  buildAuthorizationRequest,
  buildAuthorizationResponse,
  retrievalReferenceNumber,
};
