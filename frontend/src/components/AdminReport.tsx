import { useEffect, useState } from "react";
import { getTransactions } from "../services/api";

interface AdminReportProps {
  token: string;
}

interface Transaction {
  id: string;
  card_number: string;
  amount: number;
  merchant_id: string;
  status: string;
  type: string;
  timestamp: string;
  created_at: string;
  updated_at: string;
  iso8583_message: any;
}

export default function AdminReport({ token }: AdminReportProps) {
  const [report, setReport] = useState<{
    totalTransactions: number;
    totalAmount: number;
    successfulTransactions: number;
    failedTransactions: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await fetch("https://transactionsimulator.onrender.com/api/transactions", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch transactions");
        }

        const transactions: Transaction[] = await response.json();

        const totalTransactions = transactions.length;
        const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
        const successfulTransactions = transactions.filter((tx) => tx.status === "APPROVED").length;
        const failedTransactions = transactions.filter((tx) => tx.status === "DECLINED").length;

        setReport({
          totalTransactions,
          totalAmount,
          successfulTransactions,
          failedTransactions,
        });
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [token]);

  if (loading) return <p>Loading report...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="space-y-4 mt-6">
      <h3 className="text-lg font-medium text-gray-900">Admin Report</h3>
      <div className="bg-gray-50 p-4 rounded-md">
        {report ? (
          <div className="space-y-2">
            <p><strong>Total Transactions:</strong> {report.totalTransactions}</p>
            <p><strong>Total Amount:</strong> ${report.totalAmount.toFixed(2)}</p>
            <p><strong>Successful Transactions:</strong> {report.successfulTransactions}</p>
            <p><strong>Failed Transactions:</strong> {report.failedTransactions}</p>
          </div>
        ) : (
          <p>No transactions available.</p>
        )}
      </div>
    </div>
  );
}