import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const pricingPlans = [
  {
    name: "FREE",
    price: "₹0",
    subtitle: "Hackathon starter",
    features: [
      "100 MB max file size",
      "1 GB monthly encrypted usage",
      "Expiring links and key destruction",
    ],
  },
  {
    name: "PRO",
    price: "₹999",
    subtitle: "For serious teams",
    features: [
      "5 GB max file size",
      "100 GB included monthly usage",
      "₹30 per GB beyond included quota",
    ],
  },
  {
    name: "ENTERPRISE",
    price: "Custom",
    subtitle: "Compliance-heavy deployments",
    features: [
      "20 GB+ uploads and custom quota",
      "Audit and compliance workflows",
      "₹20 per GB over enterprise allocation",
    ],
  },
];

export function PricingPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-white/10 bg-slate-950/70 p-8 shadow-card">
        <p className="text-xs uppercase tracking-[0.35em] text-pulse">Pricing</p>
        <h1 className="mt-3 font-display text-4xl font-bold text-white md:text-5xl">
          SaaS pricing for hybrid-encrypted file sharing
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-300 md:text-base">
          Vanish Vault combines cryptographic deletion, usage-aware billing, and compliance
          visibility so you can present a real SaaS security product instead of just a feature demo.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {pricingPlans.map((plan, index) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            className="rounded-[30px] border border-white/10 bg-slate-950/70 p-6 shadow-card"
          >
            <p className="text-xs uppercase tracking-[0.35em] text-pulse">{plan.name}</p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-white">{plan.price}</h2>
            <p className="mt-2 text-sm text-slate-300">{plan.subtitle}</p>
            <div className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <div key={feature} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                  {feature}
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </section>

      <section className="rounded-[32px] border border-pulse/20 bg-pulse/10 p-8 shadow-card">
        <p className="text-xs uppercase tracking-[0.35em] text-pulse">Get Started</p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-white">
          Back to the secure operations dashboard
        </h2>
        <p className="mt-4 text-sm leading-7 text-slate-200">
          Continue to the product UI to test chunked uploads, usage dashboards, breach simulation,
          and cryptographic deletion workflows.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-2xl bg-gradient-to-r from-pulse to-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:scale-[1.01]"
        >
          Open Vanish Vault
        </Link>
      </section>
    </div>
  );
}
