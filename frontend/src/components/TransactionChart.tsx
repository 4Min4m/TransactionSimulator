import { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, ChartData, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import { getTransactions } from "../services/api";
import { Transaction } from "../types/iso8583";
import { errorMessage } from "../services/errors";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function TransactionChart() {
  const [chartData, setChartData] = useState<ChartData<"bar"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const transactions = await getTransactions();
        // Group by ISO 8583 response code: approvals and each decline reason.
        const byCode = new Map<string, number>();
        transactions.forEach((tx: Transaction) => {
          const code = tx.response_code ?? (tx.status === "APPROVED" ? "00" : "??");
          byCode.set(code, (byCode.get(code) || 0) + 1);
        });
        const codes = [...byCode.keys()].sort();

        setChartData({
          labels: codes.map((c) => (c === "00" ? "00 approved" : `${c} declined`)),
          datasets: [
            {
              label: "Transactions (last 50)",
              data: codes.map((c) => byCode.get(c) ?? 0),
              backgroundColor: codes.map((c) => (c === "00" ? "#16a34a" : "#dc2626")),
            },
          ],
        });
      } catch (err) {
        setError(errorMessage(err, "Failed to fetch transactions"));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <p>Loading chart...</p>;
  if (error) return null; // TransactionHistory already shows the sign-in hint

  return (
    <div className="space-y-4 mt-6">
      <h3 className="text-lg font-medium text-gray-900">Transaction Statistics</h3>
      <div className="bg-gray-50 p-4 rounded-md">
        {chartData && (
          <Bar
            data={chartData}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "top" },
                title: { display: true, text: "Outcomes by response code (field 39)" },
              },
            }}
          />
        )}
      </div>
    </div>
  );
}
