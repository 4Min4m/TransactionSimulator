import { useEffect, useState } from "react";
import { getTransactions } from "../services/api";
import { Transaction } from "../types/iso8583";
import { errorMessage } from "../services/errors";

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTransactions(10)
      .then(setTransactions)
      .catch((err) => setError(errorMessage(err, "Failed to fetch transactions")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="mt-6 text-sm text-gray-500">Loading history...</p>;
  if (error) return <p className="mt-6 text-sm text-gray-600">{error}</p>;

  return (
    <div className="space-y-3 mt-6">
      <h3 className="text-lg font-medium text-gray-900">Recent Transactions</h3>
      {transactions.length === 0 ? (
        <p className="text-sm text-gray-600">No transactions yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1 pr-3">Time</th>
                <th className="py-1 pr-3">Card</th>
                <th className="py-1 pr-3 text-right">Amount</th>
                <th className="py-1 pr-3">Code</th>
                <th className="py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-t border-gray-100">
                  <td className="py-1 pr-3 whitespace-nowrap">{new Date(tx.created_at).toLocaleTimeString()}</td>
                  <td className="py-1 pr-3 font-mono">{tx.card_number}</td>
                  <td className="py-1 pr-3 text-right">
                    {Number(tx.amount).toFixed(2)} {tx.currency || "USD"}
                  </td>
                  <td className="py-1 pr-3 font-mono">{tx.response_code ?? "—"}</td>
                  <td className={`py-1 ${tx.status === "APPROVED" ? "text-green-700" : "text-red-700"}`}>
                    {tx.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
