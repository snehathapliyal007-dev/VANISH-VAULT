import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, Route, Routes } from "react-router-dom";
import { api } from "./lib/api";
import { HeroSection } from "./components/HeroSection";
import { AuthPanel } from "./components/AuthPanel";
import { Dashboard } from "./components/Dashboard";
import { SharedAccessPage } from "./components/SharedAccessPage";
import { PricingPage } from "./components/PricingPage";

function Toast({ toast }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          className={`fixed right-4 top-4 z-[60] rounded-2xl border px-4 py-3 shadow-card ${
            toast.type === "error"
              ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
              : "border-pulse/30 bg-slate-950/90 text-slate-100"
          }`}
        >
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MainPage({ token, user, onAuthSuccess, onLogout, onUserUpdate, showToast }) {
  async function handleAuth(mode, form) {
    try {
      const response =
        mode === "login"
          ? await api.login({ email: form.email, password: form.password })
          : await api.signup(form);

      onAuthSuccess(response.token, response.user);
      showToast(mode === "login" ? "Secure session opened." : "Account created and signed in.");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  if (token && user) {
    return (
      <Dashboard
        token={token}
        user={user}
        onLogout={onLogout}
        onUserUpdate={onUserUpdate}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
      <HeroSection />
      <AuthPanel onSubmit={handleAuth} />
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("vanish-vault-token"));
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(Boolean(token));
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  function showToast(message, type = "success") {
    setToast({ message, type });
    window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 3200);
  }

  function handleAuthSuccess(nextToken, nextUser) {
    localStorage.setItem("vanish-vault-token", nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }

  function handleLogout() {
    localStorage.removeItem("vanish-vault-token");
    setToken(null);
    setUser(null);
    showToast("Session closed.");
  }

  function handleUserUpdate(nextUser) {
    setUser((current) => ({
      ...(current || {}),
      ...nextUser,
    }));
  }

  useEffect(() => {
    if (!token) {
      setBooting(false);
      return;
    }

    async function bootstrapUser() {
      try {
        const response = await api.getMe(token);
        setUser(response.user);
      } catch {
        localStorage.removeItem("vanish-vault-token");
        setToken(null);
      } finally {
        setBooting(false);
      }
    }

    bootstrapUser();
  }, [token]);

  useEffect(() => {
    return () => window.clearTimeout(toastTimeoutRef.current);
  }, []);

  return (
    <div className="min-h-screen overflow-hidden bg-abyss text-white">
      <div className="fixed inset-0 bg-grid bg-[size:42px_42px] opacity-20" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(69,213,255,0.14),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(255,95,158,0.12),_transparent_28%),linear-gradient(180deg,_rgba(5,8,22,0.7),_rgba(5,8,22,0.98))]" />

      <Toast toast={toast} />

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-pulse">Cyber Security Platform</p>
            <p className="mt-2 font-display text-2xl font-semibold text-white">Vanish Vault</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.35em] text-slate-300 transition hover:border-pulse/40 hover:text-white"
            >
              Home
            </Link>
            <Link
              to="/pricing"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.35em] text-slate-300 transition hover:border-pulse/40 hover:text-white"
            >
              Pricing
            </Link>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.35em] text-slate-300">
              Hybrid Encryption · SaaS Billing · GDPR Ready
            </div>
          </div>
        </div>

        {booting ? (
          <div className="rounded-[30px] border border-white/10 bg-slate-950/70 p-8 text-center shadow-card">
            Restoring secure session...
          </div>
        ) : (
          <Routes>
            <Route
              path="/"
              element={
                <MainPage
                  token={token}
                  user={user}
                  onAuthSuccess={handleAuthSuccess}
                  onLogout={handleLogout}
                  onUserUpdate={handleUserUpdate}
                  showToast={showToast}
                />
              }
            />
            <Route path="/pricing" element={<PricingPage />} />
            <Route
              path="/share/:shareToken"
              element={<SharedAccessPage showToast={showToast} />}
            />
          </Routes>
        )}
      </main>
    </div>
  );
}
