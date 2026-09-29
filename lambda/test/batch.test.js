// Async batch path: enqueue -> worker -> status, including redelivery.
const { call } = require("./helpers");
const { test } = require("node:test");
const assert = require("node:assert");
const { getStore } = require("../store");
const worker = require("../batch-worker");

const startBatch = (body) =>
  call("POST", "/api/process-batch", {
    total_transactions: 20,
    total_amount: 100,
    duration_seconds: 0,
    merchant_id: "demo-merchant",
    ...body,
  });

test("a valid batch returns 202 and completes with exact counts", async () => {
  const r = await startBatch({});
  assert.strictEqual(r.statusCode, 202);
  const { batch_id } = JSON.parse(r.body);

  const status = JSON.parse((await call("GET", `/api/batches/${batch_id}`)).body);
  assert.strictEqual(status.status, "completed");
  assert.strictEqual(status.success_count, 15); // 25% of the card pool declines
  assert.strictEqual(status.failure_count, 5);
});

test("batch amounts add up to the requested total to the cent", async () => {
  const { batch_id } = JSON.parse((await startBatch({ total_transactions: 7, total_amount: 100 })).body);
  const rows = getStore()._all().filter((t) => t.batch_id === batch_id);
  const totalMinor = rows.reduce((s, t) => s + Math.round(t.amount * 100), 0);
  assert.strictEqual(rows.length, 7);
  assert.strictEqual(totalMinor, 10000);
});

test("redelivering the same SQS message does not duplicate payments", async () => {
  const store = getStore();
  const batchId = "11111111-2222-3333-4444-555555555555";
  await store.createBatch({ id: batchId, status: "queued", total_transactions: 10, success_count: 0, failure_count: 0 });
  const message = { batch_id: batchId, total_transactions: 10, total_amount_minor: 1000, duration_seconds: 0, merchant_id: "demo-merchant" };

  // Simulate a worker that crashed mid-batch: process, then reset the status
  // so the redelivered message runs the loop again.
  await worker.handler({ Records: [{ body: JSON.stringify(message) }] });
  await store.updateBatch(batchId, { status: "processing" });
  await worker.handler({ Records: [{ body: JSON.stringify(message) }] });

  assert.strictEqual(store._all().filter((t) => t.batch_id === batchId).length, 10);
  const batch = await store.getBatch(batchId);
  assert.strictEqual(batch.success_count + batch.failure_count, 10);
});

test("a message for an already-completed batch is acknowledged and skipped", async () => {
  const store = getStore();
  const batchId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  await store.createBatch({ id: batchId, status: "completed", total_transactions: 5, success_count: 5, failure_count: 0 });
  await worker.handler({
    Records: [{ body: JSON.stringify({ batch_id: batchId, total_transactions: 5, total_amount_minor: 500, duration_seconds: 0, merchant_id: "demo-merchant" }) }],
  });
  assert.strictEqual(store._all().filter((t) => t.batch_id === batchId).length, 0);
});

test("an infrastructure error is rethrown for SQS retry and marks the batch failed on the last attempt", async () => {
  const store = getStore();
  const batchId = "99999999-8888-7777-6666-555555555555";
  await store.createBatch({ id: batchId, status: "queued", total_transactions: 3, success_count: 0, failure_count: 0 });
  const original = store.insertTransaction;
  store.insertTransaction = async () => { throw new Error("database unavailable"); };
  const record = (n) => ({
    attributes: { ApproximateReceiveCount: String(n) },
    body: JSON.stringify({ batch_id: batchId, total_transactions: 3, total_amount_minor: 300, duration_seconds: 0, merchant_id: "demo-merchant" }),
  });
  try {
    await assert.rejects(() => worker.handler({ Records: [record(1)] }), /database unavailable/);
    assert.strictEqual((await store.getBatch(batchId)).status, "processing");
    await assert.rejects(() => worker.handler({ Records: [record(3)] }), /database unavailable/);
    assert.strictEqual((await store.getBatch(batchId)).status, "failed");
  } finally {
    store.insertTransaction = original;
  }
});

test("batch validation", async () => {
  const cases = [
    [{ total_transactions: 0 }, "zero transactions"],
    [{ total_transactions: 1001 }, "too many"],
    [{ total_transactions: 2.5 }, "non-integer"],
    [{ duration_seconds: 9999 }, "duration over cap"],
    [{ total_amount: 0 }, "zero amount"],
    [{ total_transactions: 100, total_amount: 0.5 }, "less than a cent each"],
    [{ merchant_id: "someone-else" }, "unknown merchant"],
  ];
  for (const [override, label] of cases) {
    assert.strictEqual((await startBatch(override)).statusCode, 400, label);
  }
});

test("GET /api/batches/:id returns 404 for an unknown batch", async () => {
  assert.strictEqual((await call("GET", "/api/batches/does-not-exist")).statusCode, 404);
});

test("the in-memory store refuses to run inside Lambda", () => {
  const { resetStore, getStore: fresh } = require("../store");
  process.env.AWS_LAMBDA_FUNCTION_NAME = "TransactionSimulatorAPI";
  resetStore();
  try {
    assert.throws(() => fresh(), /not allowed inside AWS Lambda/);
  } finally {
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    resetStore();
  }
});
