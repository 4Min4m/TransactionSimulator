import { useState } from "react";
import { CreditCard } from "lucide-react";
import TransactionForm from "./components/TransactionForm";
import BatchForm from "./components/BatchForm";
import TransactionHistory from "./components/TransactionHistory";

export default function App() {
  const [activeTab, setActiveTab] = useState<"single" | "batch">("single");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <CreditCard className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              Payment Transaction Simulator
            </h1>
          </div>
          <p className="text-gray-600">
            Test payment transactions using mock data and ISO 8583 message format
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("single")}
                className={`${
                  activeTab === "single"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Single Transaction
              </button>
              <button
                onClick={() => setActiveTab("batch")}
                className={`${
                  activeTab === "batch"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Batch Testing
              </button>
            </nav>
          </div>

          {activeTab === "single" ? <TransactionForm /> : <BatchForm />}
          <TransactionHistory />
        </div>
      </div>
    </div>
  );
}