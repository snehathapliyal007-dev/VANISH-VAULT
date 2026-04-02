import { motion } from "framer-motion";

const featureCards = [
  {
    label: "Cryptographic Deletion",
    value: "Destroy the key, not the file.",
  },
  {
    label: "Hybrid Encryption",
    value: "AES-256 + RSA wrapping + signatures.",
  },
  {
    label: "Rule Engine",
    value: "Time, views, and manual kill switch.",
  },
];

export function HeroSection() {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/70 p-8 shadow-card backdrop-blur-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(69,213,255,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(255,95,158,0.16),_transparent_30%)]" />
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl"
        >
          <div className="mb-5 inline-flex rounded-full border border-pulse/30 bg-pulse/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-pulse">
            National Hackathon Demo
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight text-white md:text-6xl">
            Vanish Vault
            <span className="mt-3 block text-2xl font-medium text-slate-300 md:text-3xl">
              Self-destructing file sharing built around access death.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
            Files are encrypted on upload, wrapped by a simulated KMS, and rendered
            permanently useless the moment the key lifecycle ends.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {featureCards.map((card, index) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + index * 0.1, duration: 0.6 }}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow"
            >
              <p className="text-xs uppercase tracking-[0.35em] text-pulse">{card.label}</p>
              <p className="mt-3 text-lg font-semibold text-white">{card.value}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

