import React, { useEffect, useRef, useState } from "react";
import { Hash, Wallet, Timer, Building2, Send } from "lucide-react";
import { startBatch, getBatchStatus, BatchStatus } from "../services/api";
import { errorMessage } from "../services/errors";

// Batches run asynchronously: POST /api/process-batch returns a batch_id
// immediately (202) and a worker Lambda processes the job from SQS. The form
// polls GET /api/batches/{id} until the batch completes or fails.
const DEMO_MERCHANT_ID = "demo-merchant";
const POLL_INTERVAL_MS = 1000;
// Longest possible batch (300 s) plus generous headroom for queueing.
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

export default function BatchForm({ onCompleted }: { onCompleted?: () => void }) {
  const [total_transactions, setTotalTransactions] = useState(10);
  const [total_amount, setTotalAmount] = useState(1000);
  const [duration_seconds, setDurationSeconds] = useState(60);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<BatchStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up any in-flight polling if the component unmounts.
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStatus(null);
    if (pollRef.current) clearInterval(pollRef.current);

    try {
      const { batch_id } = await startBatch({
        total_transactions,
        total_amount,
        duration_seconds,
        merchant_id: DEMO_MERCHANT_ID,
      });

      const startedAt = Date.now();
      pollRef.current = setInterval(async () => {
        try {
          const s = await getBatchStatus(batch_id);
          setStatus(s);
          const timedOut = Date.now() - startedAt > POLL_TIMEOUT_MS;
          if (s.status === "completed" || s.status === "failed" || timedOut) {
            if (pollRef.current) clearInterval(pollRef.current);
            setLoading(false);
            if (s.status === "completed") onCompleted?.();
            if (s.status === "failed") setError("The batch failed after retries; see the dead-letter queue alarm.");
            else if (timedOut && s.status !== "completed") setError("Stopped polling; the batch is still running.");
          }
        } catch (err) {
          if (pollRef.current) clearInterval(pollRef.current);
          setError(errorMessage(err, "Failed to fetch batch status"));
          setLoading(false);
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setError(errorMessage(err, "An error occurred"));
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4" />
            <span>Total Transactions</span>
          </div>
        </label>
        <input
          type="number"
          min="1"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          value={total_transactions}
          onChange={(e) => setTotalTransactions(parseInt(e.target.value))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            <span>Total Amount ($)</span>
          </div>
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          value={total_amount}
          onChange={(e) => setTotalAmount(parseFloat(e.target.value))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4" />
            <span>Duration (seconds, max 300)</span>
          </div>
        </label>
        <input
          type="number"
          min="0"
          max="300"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          value={duration_seconds}
          onChange={(e) => setDurationSeconds(parseInt(e.target.value))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span>Merchant</span>
          </div>
        </label>
        <input
          type="text"
          readOnly
          value={DEMO_MERCHANT_ID}
          className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 text-gray-600 shadow-sm"
        />
      </div>

      <p className="text-xs text-gray-500">
        The worker cycles through test cards, so about 25% of payments decline with codes 05, 51, 54, 59 and 96.
      </p>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <Send className="w-4 h-4" />
        {loading ? "Running Batch..." : "Run Batch Test"}
      </button>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {status && (
        <div className="mt-4 p-4 rounded-md bg-gray-50 space-y-1">
          <p className="text-sm text-gray-800">
            Status: <span className="font-medium">{status.status}</span>
          </p>
          <p className="text-sm text-gray-800">
            Processed: {status.success_count + status.failure_count} / {status.total_transactions} —
            Approved: {status.success_count}, Declined: {status.failure_count}
          </p>
        </div>
      )}
    </form>
  );
}
