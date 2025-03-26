import { useEffect, useState } from "react";
import { CreditCard, PieChart, ArrowDownUp, Clock } from "lucide-react";

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
    avgResponseTime: number;
    recentActivity: Transaction[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "successful" | "failed">("all");

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
      //  const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;
        const avgResponseTime = 120; // test

        setReport({
          totalTransactions,
          totalAmount,
          successfulTransactions,
          failedTransactions,
          avgResponseTime,
          recentActivity: transactions.slice(0, 5),
        });
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [token]);

  if (loading) return (
    <div className="flex justify-center items-center p-8">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  );
  if (error) return <p className="text-red-600">{error}</p>;

  const filteredTransactions = report?.recentActivity.filter((tx) => {
    if (filter === "successful") return tx.status === "APPROVED";
    if (filter === "failed") return tx.status === "DECLINED";
    return true;
  });

  return (
    <div className="space-y-6 mt-6">
      <h2 className="text-xl font-semibold text-gray-800">Admin Dashboard</h2>

      {/* Stats Cards */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Transaction Volume</p>
                <p className="text-2xl font-bold text-gray-900">{report.totalTransactions}</p>
              </div>
              <CreditCard className="h-10 w-10 text-indigo-500" />
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900">${report.totalAmount.toFixed(2)}</p>
              </div>
              <ArrowDownUp className="h-10 w-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {((report.successfulTransactions / report.totalTransactions) * 100).toFixed(1)}%
                </p>
              </div>
              <PieChart className="h-10 w-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Avg Response Time</p>
                <p className="text-2xl font-bold text-gray-900">{report.avgResponseTime}ms</p>
              </div>
              <Clock className="h-10 w-10 text-purple-500" />
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {report && (
        <div className="bg-white shadow rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {report.recentActivity.map((tx, index) => (
              <div key={index} className="flex items-center justify-between p-2 border-b border-gray-100">
                <div className="flex items-center">
                  <div
                    className={`w-2 h-2 rounded-full mr-2 ${
                      tx.status === "APPROVED" ? "bg-green-500" : "bg-red-500"
                    }`}
                  ></div>
                  <span className="font-medium text-sm">
                    {tx.card_number?.substring(tx.card_number.length - 4).padStart(16, "*")}
                  </span>
                </div>
                <div className="text-sm text-gray-500">${tx.amount?.toFixed(2) || "0.00"}</div>
                <div className={`text-xs ${tx.status === "APPROVED" ? "text-green-600" : "text-red-600"}`}>
                  {tx.status === "APPROVED" ? "Approved" : "Declined"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction Data */}
      {report && (
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-800">Transaction History</h3>
            <select
              className="text-sm border rounded p-1"
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | "successful" | "failed")}
            >
              <option value="all">All Transactions</option>
              <option value="successful">Successful Only</option>
              <option value="failed">Failed Only</option>
            </select>
          </div>
          <div className="bg-gray-50 p-4 rounded-md">
            <pre className="overflow-auto text-sm">{JSON.stringify(filteredTransactions, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}