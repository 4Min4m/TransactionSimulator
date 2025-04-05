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
  const [token, setToken] = useState<string | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);

  const handleSignIn = (newToken: string) => {
    setToken(newToken);
    setShowSignIn(false);
  };

  const handleSignOut = () => {
    setToken(null);
  };

  return (
    <Router>
      <div className="min-h-screen bg-[#daf1df]"> {/* پس‌زمینه سبز روشن */}
        <div className="max-w-2xl mx-auto p-6 relative">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <CreditCard className="w-8 h-8 text-[#255346]" /> {/* آیکون سبز تیره */}
              <h1 className="text-3xl font-bold text-[#0b2b26]">
                Payment Transaction Simulator
              </h1>
            </div>
            <p className="text-[#153832]"> {/* متن ثانویه سبز متوسط */}
              Test payment transactions using mock data and ISO 8583 message format
            </p>
          </div>

          <div className="flex justify-end mb-4">
            {!token ? (
              <button
                onClick={() => setShowSignIn(true)}
                className="px-4 py-2 bg-[#255346] text-white rounded-md hover:bg-[#8bb69b]" /* دکمه سبز تیره با هاور سبز روشن */
              >
                Sign In
              </button>
            ) : (
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-[#255346] text-white rounded-md hover:bg-[#8bb69b]"
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
                  <div className="border-b border-[#8bb69b] mb-6"> {/* خط سبز روشن */}
                    <nav className="-mb-px flex space-x-8">
                      <button
                        onClick={() => setActiveTab("single")}
                        className={`${
                          activeTab === "single"
                            ? "border-[#255346] text-[#255346]" /* فعال: سبز تیره */
                            : "border-transparent text-[#153832] hover:text-[#0b2b26] hover:border-[#8bb69b]" /* غیرفعال: سبز متوسط با هاور */
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                      >
                        Single Transaction
                      </button>
                      <button
                        onClick={() => setActiveTab("batch")}
                        className={`${
                          activeTab === "batch"
                            ? "border-[#255346] text-[#255346]"
                            : "border-transparent text-[#153832] hover:text-[#0b2b26] hover:border-[#8bb69b]"
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
                token ? (
                  <div className="bg-white shadow rounded-lg p-6">
                    <AdminReport token={token} />
                  </div>
                ) : (
                  <div className="text-center text-[#0b2b26]"> {/* متن خطا سبز تیره */}
                    Please sign in to access the admin dashboard.
                  </div>
                )
              }
            />
          </Routes>

          {showSignIn && !token && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="relative">
                <SignInForm onSignIn={handleSignIn} />
                <button
                  onClick={() => setShowSignIn(false)}
                  className="absolute top-4 right-4 text-white bg-[#255346] rounded-full w-8 h-8 flex items-center justify-center hover:bg-[#8bb69b]"
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