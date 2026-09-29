// Batch worker, triggered by SQS (see terraform/batch-worker.tf).
//
// POST /api/process-batch only validates the request, writes a `batches` row
// and enqueues a message; this worker does the actual load test in the
// background while the client polls GET /api/batches/{id}.
//
// Delivery is at-least-once, so the worker is written to be safely re-run:
//   - each simulated payment has a deterministic order_id
//     (`<batch_id>:<index>`), and the UNIQUE (merchant_id, order_id) index
//     turns a redelivered payment into an idempotent replay, not a duplicate;
//   - a batch already marked `completed` is acknowledged and skipped;
//   - final counts are read back from the database, not from in-memory
//     counters, so a resumed run still reports exact totals.
//
// Business declines are normal outcomes and are counted. Infrastructure
// errors (e.g. the database is unreachable) are thrown so SQS retries the
// message; after MAX_RECEIVE_COUNT attempts the batch is marked `failed` and
// the message moves to the dead-letter queue.

const { getStore } = require("./store");
const { processPayment } = require("./payments");
const log = require("./log");

const MAX_RECEIVE_COUNT = Number(process.env.MAX_RECEIVE_COUNT || 3);

// Deterministic mix of approvals and declines (25% decline rate), cycled by
// transaction index. Declining PANs are the test cards in authorization.js.
const CARD_POOL = Object.freeze([
  "4111111111111111", "5555555555554444", "378282246310005", "6011111111111117",
  "4000000000000002", // 05 do not honor
  "4111111111111111", "5555555555554444", "378282246310005", "6011111111111117",
  "4000000000009995", // 51 insufficient funds
  "4111111111111111", "5555555555554444", "378282246310005", "6011111111111117",
  "4000000000000069", // 54 expired card
  "4111111111111111", "5555555555554444", "4000000000000259", // 59 suspected fraud
  "6011111111111117", "4000000000000119", // 96 system malfunction
]);

// Split an amount across n payments without losing a cent: the first
// `remainder` payments carry one extra minor unit.
const splitAmount = (totalMinor, n) => {
  const base = Math.floor(totalMinor / n);
  const remainder = totalMinor - base * n;
  return (i) => base + (i < remainder ? 1 : 0);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const processBatch = async (message) => {
  const { batch_id, total_transactions, total_amount_minor, duration_seconds, merchant_id } = message;
  const store = getStore();

  const batch = await store.getBatch(batch_id);
  if (!batch) {
    log.warn("batch not found, dropping message", { batchId: batch_id });
    return;
  }
  if (batch.status === "completed") {
    log.info("batch already completed, duplicate delivery ignored", { batchId: batch_id });
    return;
  }

  await store.updateBatch(batch_id, { status: "processing" });

  const amountFor = splitAmount(total_amount_minor, total_transactions);
  const delayMs = (duration_seconds * 1000) / total_transactions;
  const progressEvery = Math.max(1, Math.ceil(total_transactions / 10));
  let approved = 0;
  let declined = 0;

  for (let i = 0; i < total_transactions; i++) {
    const { replayed, row } = await processPayment(store, {
      merchantId: merchant_id,
      orderId: `${batch_id}:${i}`,
      pan: CARD_POOL[i % CARD_POOL.length],
      amountMinor: amountFor(i),
      batchId: batch_id,
    });
    if (row.status === "APPROVED") approved++;
    else declined++;

    if ((i + 1) % progressEvery === 0) {
      await store.updateBatch(batch_id, { success_count: approved, failure_count: declined });
    }
    // Pace only new work; replayed payments from an earlier attempt are
    // caught up immediately.
    if (!replayed && delayMs > 0 && i + 1 < total_transactions) await sleep(delayMs);
  }

  const totals = await store.countBatchOutcomes(batch_id);
  await store.updateBatch(batch_id, {
    status: "completed",
    success_count: totals.approved,
    failure_count: totals.declined,
  });
  log.info("batch completed", { batchId: batch_id, ...totals });
};

exports.handler = async (event) => {
  for (const record of (event && event.Records) || []) {
    const message = JSON.parse(record.body);
    try {
      await processBatch(message);
    } catch (err) {
      const attempt = Number(record.attributes?.ApproximateReceiveCount || 1);
      log.error("batch attempt failed", { batchId: message.batch_id, attempt, error: String(err && err.message) });
      if (attempt >= MAX_RECEIVE_COUNT) {
        // Last attempt before the DLQ: make the failure visible to pollers.
        await getStore()
          .updateBatch(message.batch_id, { status: "failed" })
          .catch(() => {});
      }
      throw err; // let SQS redeliver (or dead-letter) the message
    }
  }
};

exports._internal = { CARD_POOL, splitAmount, processBatch };
