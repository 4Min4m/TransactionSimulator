const { test } = require("node:test");
const assert = require("node:assert");
const iso = require("../iso8583");

const now = new Date(Date.UTC(2026, 8, 28, 14, 5, 9)); // 2026-09-28T14:05:09Z

test("bitmap sets exactly the bits of the present fields", () => {
  // Fields 2, 3, 4 -> bits 2,3,4 -> 0111 0000 ... -> 7000000000000000
  assert.strictEqual(iso.buildBitmap([2, 3, 4]), "7000000000000000");
  assert.deepStrictEqual(iso.parseBitmap("7000000000000000"), [2, 3, 4]);
  assert.deepStrictEqual(iso.parseBitmap(iso.buildBitmap([2, 11, 39, 64])), [2, 11, 39, 64]);
});

test("pack/unpack round-trips an authorization request", () => {
  const req = iso.buildAuthorizationRequest({
    pan: "4111111111111111", amountMinor: 2550, merchantId: "demo-merchant", now, stan: "000123",
  });
  const raw = iso.pack(req.mti, req.fields);
  assert.ok(raw.startsWith("0100"));
  const back = iso.unpack(raw);
  assert.strictEqual(back.mti, "0100");
  assert.strictEqual(back.fields[2], "4111111111111111");
  assert.strictEqual(back.fields[4], "000000002550"); // n12, zero-padded minor units
  assert.strictEqual(back.fields[7], "0928140509"); // MMDDhhmmss
  assert.strictEqual(back.fields[42], "demo-merchant");
  assert.strictEqual(back.fields[49], "840");
});

test("LLVAR field 2 carries a 2-digit length prefix", () => {
  const raw = iso.pack("0100", { 2: "378282246310005" });
  assert.strictEqual(raw.slice(20), "15378282246310005");
});

test("response echoes the request and adds RRN, auth code and response code", () => {
  const req = iso.buildAuthorizationRequest({ pan: "4111111111111111", amountMinor: 100, merchantId: "m", now, stan: "000777" });
  const res = iso.buildAuthorizationResponse(req, { responseCode: "00", authorizationCode: "A1B2C3" }, now);
  assert.strictEqual(res.mti, "0110");
  assert.strictEqual(res.fields[11], "000777");
  assert.strictEqual(res.fields[37], "627114000777"); // Y=6, DDD=271, HH=14, STAN
  assert.strictEqual(res.fields[38], "A1B2C3");
  assert.strictEqual(res.fields[39], "00");
  assert.deepStrictEqual(iso.unpack(iso.pack(res.mti, res.fields)).fields[39], "00");
});

test("declines carry no field 38", () => {
  const req = iso.buildAuthorizationRequest({ pan: "4000000000000002", amountMinor: 100, merchantId: "m", now });
  const res = iso.buildAuthorizationResponse(req, { responseCode: "05", authorizationCode: null }, now);
  assert.ok(!(38 in res.fields));
});

test("invalid data is rejected, not silently truncated", () => {
  assert.throws(() => iso.pack("0100", { 4: "12.50" }), iso.Iso8583Error);
  assert.throws(() => iso.pack("0100", { 42: "merchant-id-that-is-too-long" }), iso.Iso8583Error);
  assert.throws(() => iso.pack("0100", { 99: "x" }), iso.Iso8583Error);
  assert.throws(() => iso.pack("01A0", { 3: "000000" }), iso.Iso8583Error);
  assert.throws(() => iso.unpack("0100" + "7000000000000000" + "16411111"), iso.Iso8583Error);
});

test("a masked PAN is only accepted when packing for storage", () => {
  assert.throws(() => iso.pack("0100", { 2: "4111********1111" }), iso.Iso8583Error);
  assert.ok(iso.pack("0100", { 2: "4111********1111" }, { allowMaskedPan: true }));
});
