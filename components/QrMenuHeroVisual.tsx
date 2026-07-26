"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { Lock, RefreshCw } from "lucide-react";

// ---------------------------------------------------------------------------
// The product's whole promise in one visual: the phone's menu keeps changing
// while the QR beside it never does. The QR is rendered once from a fixed
// string and deliberately never re-rendered, so what the viewer sees really is
// the same code throughout — not a claim, a demonstration.
// ---------------------------------------------------------------------------

const PERMANENT_LINK = "https://menu.setutechnology.com/m/sharmas-kitchen";

interface Dish {
  name: string;
  price: string;
  tag: "veg" | "nonveg";
  soldOut?: boolean;
  note?: string;
}

const MENU_STATES: { label: string; dishes: Dish[] }[] = [
  {
    label: "Lunch menu",
    dishes: [
      { name: "Paneer Tikka", price: "₹249", tag: "veg" },
      { name: "Butter Chicken", price: "₹349", tag: "nonveg" },
      { name: "Dal Makhani", price: "₹279", tag: "veg" },
    ],
  },
  {
    label: "Price updated",
    dishes: [
      { name: "Paneer Tikka", price: "₹279", tag: "veg", note: "new price" },
      { name: "Butter Chicken", price: "₹349", tag: "nonveg" },
      { name: "Dal Makhani", price: "₹279", tag: "veg" },
    ],
  },
  {
    label: "Sold out",
    dishes: [
      { name: "Paneer Tikka", price: "₹279", tag: "veg" },
      { name: "Butter Chicken", price: "₹349", tag: "nonveg", soldOut: true },
      { name: "Dal Makhani", price: "₹279", tag: "veg" },
    ],
  },
  {
    label: "Winter menu",
    dishes: [
      { name: "Gajar Halwa", price: "₹149", tag: "veg", note: "new dish" },
      { name: "Paneer Tikka", price: "₹279", tag: "veg" },
      { name: "Dal Makhani", price: "₹279", tag: "veg" },
    ],
  },
];

function DietMark({ tag }: { tag: Dish["tag"] }) {
  const color = tag === "veg" ? "#1B7A43" : "#B3261E";
  return (
    <span
      className="inline-flex h-3 w-3 flex-shrink-0 items-center justify-center border"
      style={{ borderColor: color }}
      aria-hidden="true"
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

export function QrMenuHeroVisual() {
  const [step, setStep] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // Respect a reduced-motion preference by holding on the first state.
    if (reduceMotion) return;
    const timer = setInterval(() => setStep((s) => (s + 1) % MENU_STATES.length), 2600);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  const state = MENU_STATES[step];

  return (
    <div className="relative mx-auto flex w-full max-w-xl items-center justify-center gap-4 sm:gap-8">
      {/* The QR — mounted once, never keyed on `step`, so it cannot re-render */}
      <div className="flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="rounded-2xl border border-indigo/15 bg-white p-3 shadow-sm sm:p-4"
        >
          <QRCodeSVG value={PERMANENT_LINK} size={104} level="M" marginSize={0} />
        </motion.div>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo/5 px-2.5 py-1">
          <Lock className="h-3 w-3 text-indigo" aria-hidden="true" />
          <span className="text-[10px] font-semibold text-indigo">Never changes</span>
        </div>
      </div>

      {/* Flow line from the code to the phone */}
      <div className="relative hidden h-px flex-1 sm:block" aria-hidden="true">
        <div className="h-px w-full bg-gradient-to-r from-indigo/30 to-saffron/40" />
        {!reduceMotion && (
          <motion.span
            className="absolute -top-[3px] h-[7px] w-[7px] rounded-full bg-saffron"
            animate={{ left: ["0%", "100%"] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "linear" }}
          />
        )}
      </div>

      {/* The phone — its contents swap on every step */}
      <div className="relative w-[190px] flex-shrink-0 sm:w-[210px]">
        <div className="rounded-[24px] border-[6px] border-ink/85 bg-white shadow-xl">
          <div className="rounded-[18px] bg-cream-paper">
            <div className="rounded-t-[18px] bg-indigo px-3 py-3 text-center">
              <p className="text-[11px] font-bold text-white">Sharma&apos;s Kitchen</p>
              <AnimatePresence mode="wait">
                <motion.p
                  key={state.label}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.3 }}
                  className="mt-0.5 text-[9px] text-white/75"
                >
                  {state.label}
                </motion.p>
              </AnimatePresence>
            </div>

            <div className="space-y-1.5 px-3 py-3">
              <AnimatePresence mode="wait">
                <motion.ul
                  key={step}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-1.5"
                >
                  {state.dishes.map((dish, index) => (
                    <motion.li
                      key={`${dish.name}-${index}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: index * 0.06 }}
                      className={`flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 ${
                        dish.soldOut ? "opacity-55" : ""
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <DietMark tag={dish.tag} />
                        <span
                          className={`truncate text-[10px] font-medium text-ink ${
                            dish.soldOut ? "line-through" : ""
                          }`}
                        >
                          {dish.name}
                        </span>
                      </span>
                      {dish.soldOut ? (
                        <span className="whitespace-nowrap rounded bg-ink/10 px-1 py-0.5 text-[8px] font-semibold text-muted">
                          Sold out
                        </span>
                      ) : (
                        <span className="whitespace-nowrap text-[10px] font-bold text-ink">
                          {dish.price}
                        </span>
                      )}
                    </motion.li>
                  ))}
                </motion.ul>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Badge calling out what just changed */}
        <AnimatePresence>
          {state.dishes.some((dish) => dish.note) && !reduceMotion && (
            <motion.div
              key={step}
              initial={{ opacity: 0, scale: 0.85, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.3 }}
              className="absolute -right-2 -top-2 inline-flex items-center gap-1 rounded-full bg-saffron px-2 py-1 shadow"
            >
              <RefreshCw className="h-2.5 w-2.5 text-ink" aria-hidden="true" />
              <span className="text-[9px] font-bold text-ink">
                {state.dishes.find((dish) => dish.note)?.note}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
