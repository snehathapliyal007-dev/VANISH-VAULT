import { AnimatePresence, motion } from "framer-motion";

const upgradeCopy = {
  PRO: {
    title: "Upgrade to Pro",
    description: "Unlock up to 5 GB per file and 100 GB monthly secure transfer.",
  },
  ENTERPRISE: {
    title: "Move to Enterprise",
    description: "Enable large-scale workloads, bigger quotas, and lower overage pricing.",
  },
};

export function UpgradeModal({ open, plan = "PRO", onClose, onUpgrade, loading }) {
  const copy = upgradeCopy[plan] || upgradeCopy.PRO;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg rounded-[30px] border border-white/10 bg-slate-950/95 p-8 shadow-card"
          >
            <p className="text-xs uppercase tracking-[0.35em] text-pulse">Upgrade Required</p>
            <h3 className="mt-3 font-display text-3xl font-semibold text-white">{copy.title}</h3>
            <p className="mt-4 text-sm leading-7 text-slate-300">{copy.description}</p>

            <div className="mt-6 rounded-3xl border border-pulse/20 bg-pulse/10 p-4 text-sm leading-7 text-cyan-50">
              Your current upload exceeded the limits of the active plan. Switch plans for the demo
              and continue without losing the rest of the platform flow.
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onUpgrade(plan)}
                disabled={loading}
                className="rounded-2xl bg-gradient-to-r from-pulse to-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:scale-[1.01] disabled:opacity-60"
              >
                {loading ? "Updating..." : `Upgrade to ${plan}`}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-slate-300 transition hover:border-pulse/40 hover:text-white"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

