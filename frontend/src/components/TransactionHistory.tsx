import { useEffect, useState } from "react";
import { getTransactions } from "../services/api";

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getTransactions();
        // فقط آخرین تراکنش رو نشون بده
        setTransactions(data.slice(0, 1));
      } catch (err: any) {
        setError(err.message || "Failed to fetch transactions");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="space-y-4 mt-6">
      <h3 className="text-lg font-medium text-gray-900">Transaction History (Last Transaction)</h3>
      <div className="bg-gray-50 p-4 rounded-md">
        {transactions.length > 0 ? (
          <pre className="overflow-auto text-sm">{JSON.stringify(transactions[0], null, 2)}</pre>
        ) : (
          <p>No transactions found.</p>
        )}
      </div>
    </div>
  );
}