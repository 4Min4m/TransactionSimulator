import { useEffect, useState } from "react";
import { getTransactions } from "../services/api";

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getTransactions();
        setTransactions(data);
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Last Transaction</h3>
      <div className="bg-gray-50 p-4 rounded-md">
        {transactions.length > 0 ? (
          <div>
            <p><strong>Card Number:</strong> {transactions[0].card_number}</p>
            <p><strong>Amount:</strong> ${transactions[0].amount}</p>
            <p><strong>Status:</strong> {transactions[0].status}</p>
            <p><strong>Timestamp:</strong> {new Date(transactions[0].timestamp).toLocaleString()}</p>
          </div>
        ) : (
          <p>No transactions found.</p>
        )}
      </div>
    </div>
  );
}