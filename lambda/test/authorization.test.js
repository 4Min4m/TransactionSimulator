const { test } = require("node:test");
const assert = require("node:assert");
const { authorize, TEST_CARD_OUTCOMES, MAX_AMOUNT_MINOR } = require("../authorization");
const { luhnCheck } = require("../pan");

const base = { pan: "4111111111111111", amountMinor: 1000, merchantId: "m", orderId: "o-1" };

test("a normal payment is approved with a 6-character auth code", () => {
  const d = authorize(base);
  assert.strictEqual(d.responseCode, "00");
  assert.match(d.authorizationCode, /^[0-9A-F]{6}$/);
});

test("the auth code is deterministic per (merchant, order)", () => {
  assert.strictEqual(authorize(base).authorizationCode, authorize(base).authorizationCode);
  assert.notStrictEqual(authorize(base).authorizationCode, authorize({ ...base, orderId: "o-2" }).authorizationCode);
});

test("a Luhn-invalid PAN is declined with 14", () => {
  const d = authorize({ ...base, pan: "4111111111111112" });
  assert.strictEqual(d.responseCode, "14");
  assert.strictEqual(d.authorizationCode, null);
});

test("amounts above the issuer limit are declined with 61", () => {
  assert.strictEqual(authorize({ ...base, amountMinor: MAX_AMOUNT_MINOR + 1 }).responseCode, "61");
  assert.strictEqual(authorize({ ...base, amountMinor: MAX_AMOUNT_MINOR }).responseCode, "00");
});

test("every test card is Luhn-valid and maps to its decline code", () => {
  for (const [pan, code] of Object.entries(TEST_CARD_OUTCOMES)) {
    assert.ok(luhnCheck(pan), `${pan} must be Luhn-valid`);
    const d = authorize({ ...base, pan });
    assert.strictEqual(d.responseCode, code);
    assert.strictEqual(d.approved, false);
  }
});
