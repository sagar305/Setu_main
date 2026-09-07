"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  UtensilsCrossed,
  ShoppingBag,
  Stethoscope,
  GraduationCap,
  Pill,
  Wrench,
  Package,
  BellRing,
  Landmark,
  LayoutGrid,
  Check,
} from "lucide-react";

/**
 * The rotating panel beside the headline.
 *
 * Everything in here is a real product with a real page, described in the words
 * its own page uses. The panel used to animate three unlabelled progress bars —
 * "Sales 72%", "Operations 88%" — over an industry name badged "Live". The bars
 * measured nothing, and the badge claimed products that are still in
 * development, so the first thing a visitor read contradicted /products and
 * /pricing. What replaced it is the same rotation carrying capabilities the
 * product actually ships.
 *
 * Four of these are behind feature flags that are off in production. The flags
 * are server-only by design (see lib/featureFlags), and this is a client
 * component, so it cannot read them itself — the page passes `hiddenIds` in
 * instead. Without that, the hero would be the one place on the site promising
 * a Pharmacy POS that /products does not list and whose page 404s.
 */
const INDUSTRIES = [
  {
    id: "free-dine",
    name: "Restaurants",
    product: "Free Dine",
    icon: UtensilsCrossed,
    points: [
      "Tables, floor areas and kitchen tickets",
      "Split bills with the CGST/SGST breakup",
      "Recipes costed against live stock",
    ],
  },
  {
    id: "browser-pos",
    name: "Retail stores",
    product: "Browser Based POS",
    icon: ShoppingBag,
    points: [
      "Barcode billing, holds and recalls",
      "Stock, customers and udhaar in one place",
      "Thermal and A4 receipts",
    ],
  },
  {
    id: "free-clinic",
    name: "Clinics",
    product: "Free Clinic Manager",
    icon: Stethoscope,
    points: [
      "Prescriptions printed as selectable text",
      "A day screen in token order, with wait timers",
      "Receipts with a UPI QR to pay from",
    ],
  },
  {
    id: "free-tuition",
    name: "Tuition classes",
    product: "Tuition Class Manager",
    icon: GraduationCap,
    points: [
      "Batch-wise attendance in seconds",
      "Monthly fee dues that add themselves up",
      "WhatsApp reminders to parents",
    ],
  },
  {
    id: "free-pharmacy",
    name: "Medical stores",
    product: "Free Pharmacy POS",
    icon: Pill,
    points: [
      "Batch-wise stock with expiry on every strip",
      "Bills the oldest-expiring batch first",
      "Expiry dashboard at 30, 60 and 90 days",
    ],
  },
  {
    id: "free-repair",
    name: "Repair shops",
    product: "Free Repair Job Card",
    icon: Wrench,
    points: [
      "Condition photos and a signature at intake",
      "One board of every device in the shop",
      "Job slips, device tags and warranty lookup",
    ],
  },
  {
    id: "free-rental",
    name: "Tent houses & hire",
    product: "Free Rental & Hire Book",
    icon: Package,
    points: [
      "An availability calendar, date by date",
      "Damage and late fees against the deposit",
      "Picking lists and signed delivery challans",
    ],
  },
  {
    id: "free-token",
    name: "Waiting rooms",
    product: "Free Token System",
    icon: BellRing,
    points: [
      "Calls the number out loud, in eight languages",
      "A waiting-room display for a TV",
      "Wait estimates from your own timings",
    ],
  },
  {
    id: "bank-statement-analyzer",
    name: "Accountants",
    product: "Bank Statement Analyzer",
    icon: Landmark,
    points: [
      "Imports PDF, XLSX and CSV statements",
      "Rules-based classification you control",
      "Nothing uploaded — it parses on your device",
    ],
  },
  {
    id: "every-business",
    name: "Every business",
    product: "50+ free tools",
    icon: LayoutGrid,
    points: [
      "GST invoices and quotations",
      "Ledgers, cash books and stock registers",
      "Balance sheets and P&L statements",
    ],
  },
];

const STEP_DURATION = 4200;

export function HeroVisual({ hiddenIds = [] }: { hiddenIds?: string[] }) {
  const industries = INDUSTRIES.filter((item) => !hiddenIds.includes(item.id));
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % industries.length);
    }, STEP_DURATION);
    return () => clearInterval(id);
  }, [industries.length]);

  return (
    // Same border, radius and shadow as every other card on the page, so the
    // panel reads as part of the set rather than as a one-off.
    <div className="w-full max-w-sm rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-warm">
          Setu for
        </span>
        {/* The badge every free plan on /pricing carries, in the same colours. */}
        <span className="whitespace-nowrap rounded-full bg-saffron/20 px-2.5 py-1 text-[11px] font-semibold text-ink">
          Free forever
        </span>
      </div>

      {/* Every variant shares one grid cell, so the cell is as tall as the
          tallest and the panel cannot resize mid-rotation at any width. */}
      <div className="mt-5 grid">
        {industries.map((item, i) => {
          const ItemIcon = item.icon;
          const isActive = i === active;
          return (
            <motion.div
              key={item.id}
              className="col-start-1 row-start-1"
              animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 8 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              aria-hidden={!isActive}
              style={{ pointerEvents: isActive ? "auto" : "none" }}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo/10 text-indigo">
                  <ItemIcon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-tight text-ink">{item.name}</p>
                  <p className="mt-0.5 text-sm font-medium text-indigo">{item.product}</p>
                </div>
              </div>

              <ul className="mt-6 flex flex-col gap-3">
                {item.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2.5 text-sm leading-snug text-muted"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </div>

      {/* Wraps: with every flag on there are ten dots, which no longer fit
          beside the line of text on a narrow card. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-muted-line/25 pt-4">
        <p className="text-[11px] leading-relaxed text-muted">
          Runs in your browser · Works offline
        </p>
        <div className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
          {industries.map((item, i) => (
            <span
              key={item.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? "w-4 bg-indigo" : "w-1.5 bg-muted-line/50"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
