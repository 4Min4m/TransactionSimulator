import { useState } from "react";
import { CreditCard } from "lucide-react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import TransactionForm from "./components/TransactionForm";
import BatchForm from "./components/BatchForm";
import TransactionHistory from "./components/TransactionHistory";
import TransactionChart from "./components/TransactionChart";
import SignInForm from "./components/SignInForm";
import AdminReport from "./components/AdminReport";

export default function App() {
  const [activeTab, setActiveTab] = useState<"single" | "batch">("single");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [showSignIn, setShowSignIn] = useState(false);

  const handleSignIn = () => {
    setIsLoggedIn(true);
    setShowSignIn(false);
  };

  const handleSignOut = () => {
    setIsLoggedIn(false);
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto p-6 relative">
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

          {/* دکمه‌های Sign In/Sign Out */}
          <div className="flex justify-end mb-4">
            {!isLoggedIn ? (
              <button
                onClick={() => setShowSignIn(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Sign In
              </button>
            ) : (
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Sign Out
              </button>
            )}
          </div>

          <Routes>
            <Route
              path="/"
              element={
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
                  <TransactionChart />
                </div>
              }
            />
            <Route
              path="/admin"
              element={
                isLoggedIn ? (
                  <div className="bg-white shadow rounded-lg p-6">
                    <AdminReport />
                  </div>
                ) : (
                  <div className="text-center text-red-600">
                    Please sign in to access the admin dashboard.
                  </div>
                )
              }
            />
          </Routes>

          {/* مدال برای SignInForm */}
          {showSignIn && !isLoggedIn && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="relative">
                <SignInForm onSignIn={handleSignIn} />
                <button
                  onClick={() => setShowSignIn(false)}
                  className="absolute top-4 right-4 text-white bg-red-600 rounded-full w-8 h-8 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Router>
  );
}