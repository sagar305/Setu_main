"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { UtensilsCrossed, ClipboardList, ChefHat, BellRing, Receipt, IndianRupee } from "lucide-react";

const STEPS = [
  {
    label: "Table opened",
    detail: "Table 4 · Dine-in",
    icon: UtensilsCrossed,
  },
  {
    label: "Order placed",
    detail: "3 items added to cart",
    icon: ClipboardList,
  },
  {
    label: "Sent to kitchen",
    detail: "KOT printed automatically",
    icon: ChefHat,
  },
  {
    label: "Order ready",
    detail: "Server notified instantly",
    icon: BellRing,
  },
  {
    label: "Bill generated",
    detail: "Tax-ready invoice, one tap",
    icon: Receipt,
  },
  {
    label: "Payment collected",
    detail: "Table closed · ready for next guest",
    icon: IndianRupee,
  },
];

const STEP_DURATION = 2600;

export function ProductLoop() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % STEPS.length);
    }, STEP_DURATION);
    return () => clearInterval(id);
  }, []);

  const step = STEPS[active];
  const Icon = step.icon;

  return (
    <section className="bg-ink py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-saffron">
            How it flows
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">
            One order, start to finish
          </h2>
          <p className="mt-4 text-lg text-white/60">
            Every table runs through the same loop, automatically — no handoffs lost,
            nothing scribbled on paper.
          </p>
        </div>

        <div className="mt-12 grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div className="flex flex-col gap-2">
            {STEPS.map((s, i) => {
              const StepIcon = s.icon;
              const isActive = i === active;
              return (
                <div
                  key={s.label}
                  className={`relative flex items-center gap-4 rounded-xl px-4 py-3 transition-colors ${
                    isActive ? "bg-white/5" : ""
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                      isActive ? "bg-saffron text-ink" : "bg-white/10 text-white/40"
                    }`}
                  >
                    <StepIcon className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${isActive ? "text-white" : "text-white/50"}`}>
                      {s.label}
                    </p>
                  </div>
                  {isActive && (
                    <span className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
                      <motion.span
                        key={active}
                        className="block h-full bg-saffron"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: STEP_DURATION / 1000, ease: "linear" }}
                      />
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex aspect-square w-full max-w-sm items-center justify-center justify-self-center rounded-2xl bg-white/5">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="flex flex-col items-center gap-4 px-6 text-center"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-saffron text-ink">
                  <Icon className="h-8 w-8" />
                </span>
                <p className="text-lg font-semibold text-white">{step.label}</p>
                <p className="text-sm text-white/50">{step.detail}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
