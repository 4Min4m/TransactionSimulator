import { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import { getTransactions } from "../services/api";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function TransactionChart() {
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const transactions = await getTransactions(); // توکن حذف شده
        const successCount = transactions.filter((tx: any) => tx.status === "APPROVED").length;
        const failureCount = transactions.filter((tx: any) => tx.status === "DECLINED").length;

        setChartData({
          labels: ["Successful", "Failed"],
          datasets: [
            {
              label: "Transactions",
              data: [successCount, failureCount],
              backgroundColor: ["#4CAF50", "#F44336"],
            },
          ],
        });
      } catch (error) {
        console.error("Error fetching transactions for chart:", error);
        setError("Failed to fetch transactions");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <p>Loading chart...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Transaction Statistics</h3>
      <div className="bg-gray-50 p-4 rounded-md">
        {chartData && (
          <Bar
            data={chartData}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "top" },
                title: { display: true, text: "Transaction Success vs Failure" },
              },
            }}
          />
        )}
      </div>
    </div>
  );
}