import { useCallback, useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import TransactionForm from "./components/TransactionForm";
import BatchForm from "./components/BatchForm";
import AdminReport from "./components/AdminReport";
import SignInForm from "./components/SignInForm";
import { isAuthenticated, clearToken, AUTH_EXPIRED_EVENT } from "./services/auth";

export default function App() {
  // Initialize from a (non-expired) token so the session survives a refresh.
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(isAuthenticated());
  const [signIn, setSignIn] = useState<{ open: boolean; notice?: string }>({ open: false });

  useEffect(() => {
    const onExpired = () => setIsLoggedIn(false);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const openSignIn = useCallback((notice?: string) => setSignIn({ open: true, notice }), []);
  const closeSignIn = useCallback(() => setSignIn({ open: false }), []);

  const handleSignIn = () => {
    setIsLoggedIn(true);
    closeSignIn();
  };

  const handleSignOut = () => {
    clearToken();
    setIsLoggedIn(false);
  };

  return (
    <Router>
      <div className="min-h-screen md:grid md:grid-cols-[232px_minmax(0,1fr)]">
        <Sidebar isLoggedIn={isLoggedIn} onSignIn={() => openSignIn()} onSignOut={handleSignOut} />

        <main className="flex w-full min-w-0 max-w-[1280px] flex-col gap-7 px-5 pb-14 pt-8 md:px-[clamp(20px,3vw,44px)]">
          <Routes>
            <Route path="/" element={<TransactionForm onRequireSignIn={() => openSignIn()} />} />
            <Route path="/batch" element={<BatchForm isLoggedIn={isLoggedIn} onRequireSignIn={openSignIn} />} />
            <Route path="/admin" element={<AdminReport isLoggedIn={isLoggedIn} onRequireSignIn={() => openSignIn()} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {signIn.open && !isLoggedIn && (
          <SignInForm onSignIn={handleSignIn} onClose={closeSignIn} notice={signIn.notice} />
        )}
      </div>
    </Router>
  );
}
