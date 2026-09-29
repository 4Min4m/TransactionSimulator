const { test } = require("node:test");
const assert = require("node:assert");
const { luhnCheck, detectScheme, maskCardNumber, isValidPanFormat } = require("../pan");

test("Luhn accepts valid PANs and rejects a single-digit change", () => {
  for (const pan of ["4111111111111111", "5555555555554444", "378282246310005", "6011111111111117"]) {
    assert.ok(luhnCheck(pan), pan);
  }
  assert.ok(!luhnCheck("4111111111111112"));
});

test("scheme detection by BIN range", () => {
  assert.strictEqual(detectScheme("4111111111111111"), "VISA");
  assert.strictEqual(detectScheme("5555555555554444"), "MASTERCARD");
  assert.strictEqual(detectScheme("2223003122003222"), "MASTERCARD");
  assert.strictEqual(detectScheme("378282246310005"), "AMEX");
  assert.strictEqual(detectScheme("6011111111111117"), "DISCOVER");
  assert.strictEqual(detectScheme("9999999999999995"), "UNKNOWN");
});

test("PAN format is 12-19 digits", () => {
  assert.ok(isValidPanFormat("411111111111"));
  assert.ok(!isValidPanFormat("41111111111"));
  assert.ok(!isValidPanFormat("41111111111111111111"));
});

test("masking keeps only first 4 / last 4 and fully masks short input", () => {
  assert.strictEqual(maskCardNumber("4111111111111111"), "4111-****-****-1111");
  assert.strictEqual(maskCardNumber("4111 1111 1111 1111"), "4111-****-****-1111");
  assert.strictEqual(maskCardNumber("123"), "****");
  assert.strictEqual(maskCardNumber(undefined), "****");
});
