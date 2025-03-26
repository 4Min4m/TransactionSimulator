import { useEffect, useState } from "react";
import { getTransactions } from "../services/api";

interface TransactionHistoryProps {
  token: string;
}

export default function TransactionHistory({ token }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getTransactions(token);
        setTransactions(data);
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Transaction History</h3>
      <div className="bg-gray-50 p-4 rounded-md">
        <pre className="overflow-auto text-sm">
          {JSON.stringify(transactions, null, 2)}
        </pre>
      </div>
    </div>
  );
}