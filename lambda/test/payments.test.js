// POST /api/transactions end to end against the in-memory store.
const { call, pay } = require("./helpers");
const { test } = require("node:test");
const assert = require("node:assert");
const { getStore } = require("../store");
const iso = require("../iso8583");

test("approves a valid payment and returns ISO 8583 details", async () => {
  const r = await pay({ order_id: "approve-1" });
  assert.strictEqual(r.statusCode, 200);
  const body = JSON.parse(r.body);
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.responseCode, "00");
  assert.match(body.authorizationCode, /^[0-9A-F]{6}$/);
  assert.strictEqual(body.data.card_scheme, "VISA");
  assert.strictEqual(body.data.iso8583_message.response.mti, "0110");
});

test("declines a test card with its specific response code", async () => {
  const body = JSON.parse((await pay({ card_number: "4000000000009995" })).body);
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.responseCode, "51");
  assert.strictEqual(body.responseMessage, "Insufficient funds");
  assert.strictEqual(body.authorizationCode, null);
});

test("a Luhn-invalid card is a business decline (14), not a 400", async () => {
  const r = await pay({ card_number: "4111111111111112" });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(JSON.parse(r.body).responseCode, "14");
});

test("the raw PAN is never persisted, not even inside the ISO message", async () => {
  await pay({ order_id: "no-raw-pan", card_number: "4111 1111 1111 1111" });
  const stored = JSON.stringify(getStore()._all());
  assert.ok(!stored.includes("4111111111111111"));
  const row = getStore()._all().find((t) => t.order_id === "no-raw-pan");
  assert.strictEqual(row.card_number, "4111-****-****-1111");
  assert.strictEqual(iso.unpack(row.iso8583_message.request.raw).fields[2], "4111********1111");
});

test("retrying the same order_id replays the original result (idempotency)", async () => {
  const first = await pay({ order_id: "idem-1", amount: 10 });
  const second = await pay({ order_id: "idem-1", amount: 10 });
  assert.strictEqual(second.statusCode, 200);
  assert.strictEqual(second.headers["Idempotent-Replayed"], "true");
  assert.strictEqual(JSON.parse(second.body).idempotentReplay, true);
  assert.strictEqual(JSON.parse(second.body).data.id, JSON.parse(first.body).data.id);
  assert.strictEqual(getStore()._all().filter((t) => t.order_id === "idem-1").length, 1);
});

test("reusing an order_id with different details is a 409 conflict", async () => {
  await pay({ order_id: "idem-2", amount: 10 });
  assert.strictEqual((await pay({ order_id: "idem-2", amount: 11 })).statusCode, 409);
  assert.strictEqual((await pay({ order_id: "idem-2", amount: 10, card_number: "5555555555554444" })).statusCode, 409);
});

test("request validation", async () => {
  const cases = [
    [{ merchant_id: "not-the-demo-merchant" }, "unknown merchant"],
    [{ amount: -5 }, "negative amount"],
    [{ amount: 0 }, "zero amount"],
    [{ amount: "10" }, "string amount"],
    [{ amount: 10.001 }, "sub-cent amount"],
    [{ amount: 1e9 }, "absurd amount"],
    [{ card_number: "4111" }, "too few digits"],
    [{ card_number: "4111-1111-1111-111a" }, "non-digit PAN"],
    [{ order_id: "has spaces" }, "bad order_id"],
    [{ currency: "XYZ" }, "unsupported currency"],
  ];
  for (const [override, label] of cases) {
    assert.strictEqual((await pay(override)).statusCode, 400, label);
  }
});

test("amounts are handled in minor units without float drift", async () => {
  // 19.99 * 100 === 1998.9999999999998 in IEEE 754; field 4 must still say 1999.
  const body = JSON.parse((await pay({ order_id: "float-1", amount: 19.99 })).body);
  assert.strictEqual(body.data.amount, 19.99);
  assert.strictEqual(iso.unpack(body.data.iso8583_message.request.raw).fields[4], "000000001999");
});

test("GET /api/transactions returns newest first with pagination bounds", async () => {
  const r = await call("GET", "/api/transactions", null, {}, { limit: "2", offset: "0" });
  const body = JSON.parse(r.body);
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(body.items.length, 2);
  assert.strictEqual(body.limit, 2);
  const clamped = JSON.parse((await call("GET", "/api/transactions", null, {}, { limit: "5000" })).body);
  assert.strictEqual(clamped.limit, 50);
});

test("each new payment logs exactly one metric token for CloudWatch metric filters", async () => {
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(String(line));
  try {
    await pay({ order_id: "metric-1" });
    await pay({ order_id: "metric-1" }); // replay
    await pay({ order_id: "metric-2", card_number: "4000000000000002" });
  } finally {
    console.log = original;
  }
  const tokens = lines.map((l) => JSON.parse(l).metric).filter(Boolean);
  assert.deepStrictEqual(tokens, ["PAYMENT_APPROVED", "PAYMENT_REPLAYED", "PAYMENT_DECLINED"]);
  assert.ok(!lines.join("").includes("4000000000000002"), "raw PAN must never be logged");
});
