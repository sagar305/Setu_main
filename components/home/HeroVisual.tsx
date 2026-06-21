"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { UtensilsCrossed, ShoppingBag, Stethoscope, Building2 } from "lucide-react";

const INDUSTRIES = [
  { name: "Restaurants", icon: UtensilsCrossed },
  { name: "Retail stores", icon: ShoppingBag },
  { name: "Clinics", icon: Stethoscope },
  { name: "Your business", icon: Building2 },
];

const METRICS = [
  { label: "Sales", value: 72 },
  { label: "Operations", value: 88 },
  { label: "Customers", value: 64 },
];

const STEP_DURATION = 2400;

export function HeroVisual() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % INDUSTRIES.length);
    }, STEP_DURATION);
    return () => clearInterval(id);
  }, []);

  const industry = INDUSTRIES[active];
  const Icon = industry.icon;

  return (
    <div className="relative aspect-square w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-warm">
          Setu for
        </span>
        <motion.span
          className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600"
          animate={{ opacity: [1, 0.6, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live
        </motion.span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={industry.name}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="mt-5 flex items-center gap-3"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo/10 text-indigo">
            <Icon className="h-5 w-5" />
          </span>
          <p className="text-lg font-bold text-ink">{industry.name}</p>
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex flex-col gap-4">
        {METRICS.map((metric, i) => (
          <div key={metric.label}>
            <div className="flex items-center justify-between text-xs font-medium text-muted">
              <span>{metric.label}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cream">
              <motion.div
                className="h-full rounded-full bg-saffron"
                initial={{ width: "0%" }}
                animate={{ width: `${metric.value}%` }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.15, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}
      </div>

      <motion.p
        className="mt-7 text-xs leading-relaxed text-muted"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.8 }}
      >
        One system replacing spreadsheets, registers and notebooks — built for how
        Indian and SEA businesses actually run.
      </motion.p>
    </div>
  );
}
