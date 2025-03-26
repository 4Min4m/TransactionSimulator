import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1); // فقط آخرین تراکنش
        if (error) throw new Error(error.message);
        setTransactions(data || []);
      } catch (error: any) {
        console.error("Error fetching transactions:", error);
        setError(error.message || "Failed to fetch transactions");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

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