import { useState } from "react";
import { motion } from "framer-motion";

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "uploader",
  plan: "FREE",
};

export function AuthPanel({ onSubmit, loading }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(initialForm);

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onSubmit(mode, form);

    if (mode === "signup") {
      setForm((current) => ({ ...current, password: "" }));
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6 }}
      className="rounded-[28px] border border-white/10 bg-slate-950/75 p-6 shadow-card backdrop-blur-xl"
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-pulse">Identity Gate</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-white">
            {mode === "login" ? "Enter your vault" : "Create a secure operator profile"}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setMode((current) => (current === "login" ? "signup" : "login"))}
          className="rounded-full border border-pulse/30 px-4 py-2 text-sm font-medium text-pulse transition hover:border-pulse hover:bg-pulse/10"
        >
          {mode === "login" ? "Need account?" : "Have account?"}
        </button>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {mode === "signup" && (
          <>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Full name</span>
              <input
                name="name"
                value={form.name}
                onChange={updateField}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-pulse/60"
                placeholder="Aarav Sharma"
                required
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Role</span>
                <select
                  name="role"
                  value={form.role}
                  onChange={updateField}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-pulse/60"
                >
                  <option value="uploader">Uploader</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Starting plan</span>
                <select
                  name="plan"
                  value={form.plan}
                  onChange={updateField}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-pulse/60"
                >
                  <option value="FREE">Free</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </label>
            </div>
          </>
        )}

        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">Email</span>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={updateField}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-pulse/60"
            placeholder="secure@vanishvault.app"
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">Password</span>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={updateField}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-pulse/60"
            placeholder="Minimum 8 characters"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-gradient-to-r from-pulse to-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Processing..." : mode === "login" ? "Unlock Dashboard" : "Create Account"}
        </button>
      </form>
    </motion.div>
  );
}
