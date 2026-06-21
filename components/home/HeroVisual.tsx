"use client";

import { motion } from "motion/react";
import { CheckCircle2 } from "lucide-react";

const orders = [
  { table: "Table 4", item: "2x Butter Chicken", status: "Sent to kitchen" },
  { table: "Table 9", item: "1x Paneer Tikka", status: "Preparing" },
  { table: "Table 2", item: "3x Masala Dosa", status: "Billed" },
];

export function HeroVisual() {
  return (
    <div className="relative aspect-square w-full max-w-sm rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-warm">
          Live orders
        </span>
        <motion.span
          className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600"
          animate={{ opacity: [1, 0.6, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Synced
        </motion.span>
      </div>

      <motion.div
        className="mt-4 flex flex-col gap-3"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.35, delayChildren: 0.3 } },
        }}
      >
        {orders.map((order) => (
          <motion.div
            key={order.table}
            className="flex items-center justify-between rounded-xl border border-muted-line/20 bg-cream-paper px-4 py-3"
            variants={{
              hidden: { opacity: 0, x: 16 },
              show: { opacity: 1, x: 0 },
            }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div>
              <p className="text-sm font-semibold text-ink">{order.table}</p>
              <p className="text-xs text-muted">{order.item}</p>
            </div>
            <span className="text-xs font-medium text-indigo">{order.status}</span>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className="mt-5 flex items-center gap-2 rounded-xl bg-indigo/5 px-4 py-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 1.6 }}
      >
        <CheckCircle2 className="h-4 w-4 text-indigo" />
        <p className="text-xs font-medium text-ink">GST-ready invoice generated automatically</p>
      </motion.div>
    </div>
  );
}
