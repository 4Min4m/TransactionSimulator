// Background batch worker — triggered by SQS (see terraform/batch-worker.tf).
//
// WHY THIS EXISTS: the previous design ran the whole batch loop (with a
// simulated per-transaction delay) inline inside the API Lambda that handled
// POST /api/process-batch. That blocked a request/response Lambda for up to
// `duration_seconds`, risking API Gateway/Lambda timeouts on larger batches
// and tying up billed Lambda time on nothing but `setTimeout`. Now the API
// Lambda only validates the request, writes a `batches` row, and enqueues a
// message; this worker does the actual (simulated) processing asynchronously,
// and the client polls GET /api/batches/{id} for progress.
const {
  processSingleTransaction,
  updateBatchRecord,
} = require("./shared");

const processOneMessage = async (message) => {
  const { batch_id, total_transactions, total_amount, duration_seconds, merchant_id } = message;

  const amountPerTransaction = total_amount / total_transactions;
  const delayMs = total_transactions > 0 ? (duration_seconds * 1000) / total_transactions : 0;
  // Update the batch roughly every 10% so a client polling the status
  // endpoint sees real progress instead of only "queued" -> "completed".
  const progressEvery = Math.max(1, Math.ceil(total_transactions / 10));

  let successCount = 0;
  let failureCount = 0;

  await updateBatchRecord(batch_id, { status: "processing" });

  for (let i = 0; i < total_transactions; i++) {
    try {
      const transaction = {
        card_number: "4111111111111111", // simulator uses a fixed test PAN
        amount: amountPerTransaction,
        merchant_id,
      };
      const result = await processSingleTransaction(transaction);
      if (result.success) successCount++;
      else failureCount++;
    } catch (err) {
      failureCount++;
      console.error(`[batch ${batch_id}] transaction ${i + 1} failed:`, err && err.message ? err.message : err);
    }

    if ((i + 1) % progressEvery === 0 || i + 1 === total_transactions) {
      await updateBatchRecord(batch_id, { success_count: successCount, failure_count: failureCount });
    }

    if (delayMs > 0 && i + 1 < total_transactions) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  await updateBatchRecord(batch_id, {
    status: "completed",
    success_count: successCount,
    failure_count: failureCount,
  });
};

// Standard SQS-triggered Lambda handler shape: an event with `Records`.
exports.handler = async (event) => {
  const records = (event && event.Records) || [];
  for (const record of records) {
    const message = JSON.parse(record.body);
    console.log(`Processing batch ${message.batch_id} (${message.total_transactions} transactions)`);
    await processOneMessage(message);
  }
};
