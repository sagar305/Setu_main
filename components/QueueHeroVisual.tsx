"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Receipt, ChefHat, Bell } from "lucide-react";

const TOKENS = [46, 47, 48, 49];

const TICKETS = [
  { token: 48, items: "Veg Burger ×2 · Fries", timer: "02:41" },
  { token: 49, items: "Paneer Wrap · Cold Coffee", timer: "01:05" },
];

const BILL = [
  { name: "Veg Burger", qty: 2, price: "₹240" },
  { name: "Fries (L)", qty: 1, price: "₹99" },
  { name: "Cold Coffee", qty: 1, price: "₹129" },
];

export function QueueHeroVisual() {
  const [readyCount, setReadyCount] = useState(1);

  useEffect(() => {
    const id = setInterval(() => {
      setReadyCount((count) => (count >= TOKENS.length - 1 ? 1 : count + 1));
    }, 2400);
    return () => clearInterval(id);
  }, []);

  const ready = TOKENS.slice(0, readyCount);
  const preparing = TOKENS.slice(readyCount);

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16">
      <div className="rounded-3xl bg-indigo p-4 shadow-xl shadow-indigo/20 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Counter POS */}
          <div className="rounded-2xl bg-cream-paper p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo">
                <Receipt className="h-3.5 w-3.5 text-cream-paper" aria-hidden="true" />
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-warm">Counter POS</p>
            </div>
            <div className="mt-4 space-y-2">
              {BILL.map((line) => (
                <div key={line.name} className="flex items-center justify-between text-xs text-muted">
                  <span>
                    {line.name} <span className="text-muted-warm">×{line.qty}</span>
                  </span>
                  <span className="font-medium text-ink">{line.price}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-muted-line/30 pt-3 text-sm font-bold text-ink">
              <span>Total</span>
              <span>₹468</span>
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-saffron/20 px-3 py-1 text-[11px] font-semibold text-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-saffron" aria-hidden="true" />
              Token #50 · Paid
            </div>
          </div>

          {/* Kitchen Display */}
          <div className="rounded-2xl bg-cream-paper p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo">
                <ChefHat className="h-3.5 w-3.5 text-cream-paper" aria-hidden="true" />
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-warm">Kitchen Display</p>
            </div>
            <div className="mt-4 space-y-3">
              {TICKETS.map((ticket) => (
                <div key={ticket.token} className="rounded-xl border border-muted-line/30 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-ink">#{ticket.token}</span>
                    <span className="rounded-full bg-indigo/10 px-2 py-0.5 text-[10px] font-semibold text-indigo">
                      {ticket.timer}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">{ticket.items}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Ready Screen */}
          <div className="rounded-2xl bg-cream-paper p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo">
                <Bell className="h-3.5 w-3.5 text-cream-paper" aria-hidden="true" />
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-warm">Ready Screen</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-warm">Preparing</p>
                <div className="mt-2 flex flex-col gap-2">
                  <AnimatePresence mode="popLayout">
                    {preparing.map((token) => (
                      <motion.span
                        key={token}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="rounded-lg border border-muted-line/30 bg-white py-1.5 text-center text-sm font-bold text-muted"
                      >
                        {token}
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-saffron">Ready</p>
                <div className="mt-2 flex flex-col gap-2">
                  <AnimatePresence mode="popLayout">
                    {ready.map((token) => (
                      <motion.span
                        key={token}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="rounded-lg bg-saffron py-1.5 text-center text-sm font-bold text-ink"
                      >
                        {token}
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs font-medium text-cream-paper/70">
          Order billed → kitchen notified → inventory deducted → customer picks up. All live.
        </p>
      </div>
    </div>
  );
}
