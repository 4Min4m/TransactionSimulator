import React, { useState } from "react";
import { Hash, Wallet, Timer, Building2, Send } from "lucide-react";
import { processBatch } from "../services/api";

export default function BatchForm() {
  const [total_transactions, setTotalTransactions] = useState(10);
  const [total_amount, setTotalAmount] = useState(1000);
  const [duration_seconds, setDurationSeconds] = useState(60);
  const [merchant_id, setMerchantId] = useState("MERCH001");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await processBatch({
        total_transactions: total_transactions,
        total_amount: total_amount,
        duration_seconds: duration_seconds,
        merchant_id: merchant_id, 
      });
      setResult(response);
    } catch (error) {
      console.error("Error processing batch:", error);
      setResult({ success: false, message: "An error occurred" });
    } finally {
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
            <span>Duration (seconds)</span>
          </div>
        </label>
        <input
          type="number"
          min="1"
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
        <select
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          value={merchant_id}
          onChange={(e) => setMerchantId(e.target.value)}
        >
          <option value="MERCH001">Example Store</option>
          <option value="MERCH002">Test Restaurant</option>
          <option value="MERCH003">Demo Shop</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <Send className="w-4 h-4" />
        {loading ? "Processing Batch..." : "Run Batch Test"}
      </button>

      {result && (
        <div className="mt-4 p-4 rounded-md bg-gray-50">
          <p className="text-sm text-gray-800">
            Success: {result.successCount}, Failures: {result.failureCount}
          </p>
        </div>
      )}
    </form>
  );
}