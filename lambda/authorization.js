// Deterministic issuer-side authorization rules.
//
// The simulator does not talk to a real issuer. Instead, a small ordered rule
// set decides the ISO 8583 response code (field 39) so that every outcome is
// reproducible: the same card + amount always produces the same answer. That
// makes the behaviour testable, and lets a load test exercise decline paths
// on purpose via well-known test PANs (the same convention card networks and
// PSP sandboxes use).

const crypto = require("crypto");
const { luhnCheck, isValidPanFormat, detectScheme } = require("./pan");

// ISO 8583 field 39 response codes used by the simulator.
const RESPONSE_CODES = Object.freeze({
  "00": "Approved",
  "05": "Do not honor",
  "13": "Invalid amount",
  "14": "Invalid card number",
  "51": "Insufficient funds",
  "54": "Expired card",
  "59": "Suspected fraud",
  "61": "Exceeds withdrawal amount limit",
  "96": "System malfunction",
});

// Luhn-valid test PANs that force a specific decline.
const TEST_CARD_OUTCOMES = Object.freeze({
  "4000000000000002": "05",
  "4000000000009995": "51",
  "4000000000000069": "54",
  "4000000000000259": "59",
  "4000000000000119": "96",
});

// Single-transaction ceiling, in minor units (USD 10,000.00).
const MAX_AMOUNT_MINOR = 1_000_000;

// Authorization code (field 38): 6 characters, derived from the idempotency
// key so a replayed request gets the same code back.
const authorizationCodeFor = (merchantId, orderId) =>
  crypto
    .createHash("sha256")
    .update(`${merchantId}|${orderId}`)
    .digest("hex")
    .slice(0, 6)
    .toUpperCase();

/**
 * @param {{ pan: string, amountMinor: number, merchantId: string, orderId: string }} input
 * @returns {{ approved: boolean, responseCode: string, responseMessage: string,
 *             authorizationCode: string|null, scheme: string }}
 */
const authorize = ({ pan, amountMinor, merchantId, orderId }) => {
  const decide = (code) => ({
    approved: code === "00",
    responseCode: code,
    responseMessage: RESPONSE_CODES[code],
    authorizationCode: code === "00" ? authorizationCodeFor(merchantId, orderId) : null,
    scheme: detectScheme(pan),
  });

  if (!isValidPanFormat(pan) || !luhnCheck(pan)) return decide("14");
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) return decide("13");
  if (amountMinor > MAX_AMOUNT_MINOR) return decide("61");
  if (TEST_CARD_OUTCOMES[pan]) return decide(TEST_CARD_OUTCOMES[pan]);
  return decide("00");
};

module.exports = {
  authorize,
  authorizationCodeFor,
  RESPONSE_CODES,
  TEST_CARD_OUTCOMES,
  MAX_AMOUNT_MINOR,
};
