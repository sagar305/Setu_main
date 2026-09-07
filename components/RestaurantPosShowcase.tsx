"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { motion, AnimatePresence, useInView, useReducedMotion } from "motion/react";
import {
  Building2,
  ShieldCheck,
  ChefHat,
  LayoutGrid,
  UserRound,
  Ticket,
  Percent,
  Wallet,
  LayoutDashboard,
  Receipt,
  CreditCard,
  QrCode,
} from "lucide-react";
import type { RestaurantPosContent } from "@/lib/content";

const icons: Record<string, ComponentType<{ className?: string }>> = {
  "building-2": Building2,
  "shield-check": ShieldCheck,
  "chef-hat": ChefHat,
  "layout-grid": LayoutGrid,
  "user-round": UserRound,
  ticket: Ticket,
  percent: Percent,
  wallet: Wallet,
  "layout-dashboard": LayoutDashboard,
  receipt: Receipt,
  "credit-card": CreditCard,
  "qr-code": QrCode,
};

type Feature = RestaurantPosContent["features"][number];

function FeatureRow({
  feature,
  index,
  active,
  onActivate,
}: {
  feature: Feature;
  index: number;
  active: boolean;
  onActivate: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  const reduceMotion = useReducedMotion();
  const Icon = icons[feature.icon];

  useEffect(() => {
    if (inView) {
      onActivate(index);
    }
  }, [inView, index, onActivate]);

  return (
    <motion.div
      ref={ref}
      // The active row steps forward a few pixels. Small enough not to shift
      // the reading position, big enough to say which row the panel is showing.
      animate={reduceMotion ? {} : { x: active ? 6 : 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className={`flex min-h-[50vh] items-center gap-5 border-l-2 pl-6 transition-colors duration-300 md:min-h-[55vh] ${
        active ? "border-saffron" : "border-muted-line/30"
      }`}
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors md:hidden ${
        active ? "bg-saffron" : "bg-cream"
      }`}>
        <Icon className={`h-5 w-5 ${active ? "text-ink" : "text-indigo"}`} aria-hidden="true" />
      </span>
      <div>
        <span className={`text-xs font-semibold uppercase tracking-[0.2em] transition-colors ${
          active ? "text-saffron" : "text-muted-warm"
        }`}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <h3 className={`mt-3 text-2xl font-bold tracking-tight transition-colors ${active ? "text-ink" : "text-muted"}`}>
          {feature.heading}
        </h3>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">{feature.body}</p>
      </div>
    </motion.div>
  );
}

/** The progress ring: radius, and the circumference its dash array needs.
 *  The ring must clear the 64px icon tile it surrounds, or it renders
 *  underneath the tile's edge and is invisible. */
const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;

export function RestaurantPosShowcase({ features }: { features: Feature[] }) {
  const [active, setActive] = useState(0);
  const reduceMotion = useReducedMotion();
  const ActiveIcon = icons[features[active].icon];

  // How far through the list the reader is. The ring is the one piece of motion
  // here that carries information rather than decoration: on a twelve-feature
  // scroll it answers "how much more of this is there?".
  const progress = (active + 1) / features.length;

  return (
    <section className="bg-white py-12">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-[1fr_320px]">
        <div>
          {features.map((feature, index) => (
            <FeatureRow key={feature.heading} feature={feature} index={index} active={active === index} onActivate={setActive} />
          ))}
        </div>

        <div className="hidden md:block">
          <div className="sticky top-20 flex h-[calc(100vh-5rem)] flex-col items-center justify-center">
            <div className="relative w-full overflow-hidden rounded-3xl bg-indigo p-10 text-center text-cream-paper shadow-lg">
              {/* A saffron wash that drifts as the reader moves down the list,
                  so the panel is not a static block behind changing text. */}
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 -top-24 h-56 bg-[radial-gradient(closest-side,rgba(242,160,61,0.28),transparent)]"
                animate={reduceMotion ? {} : { y: progress * 120 }}
                transition={{ type: "spring", stiffness: 60, damping: 24 }}
              />

              <div className="relative flex flex-col items-center">
                {/* The icon and its progress ring stay put while the words
                    change, so the eye has something to hold on to. */}
                <div className="relative flex h-[104px] w-[104px] items-center justify-center">
                  <svg
                    className="absolute inset-0 -rotate-90"
                    viewBox="0 0 104 104"
                    aria-hidden="true"
                  >
                    <circle
                      cx="52"
                      cy="52"
                      r={RING_R}
                      fill="none"
                      strokeWidth="3"
                      className="stroke-cream-paper/20"
                    />
                    <motion.circle
                      cx="52"
                      cy="52"
                      r={RING_R}
                      fill="none"
                      strokeWidth="3"
                      strokeLinecap="round"
                      className="stroke-saffron"
                      strokeDasharray={RING_C}
                      initial={false}
                      animate={{ strokeDashoffset: RING_C * (1 - progress) }}
                      transition={{ type: "spring", stiffness: 90, damping: 20 }}
                    />
                  </svg>

                  <AnimatePresence mode="wait">
                    <motion.span
                      key={active}
                      initial={reduceMotion ? false : { scale: 0.6, opacity: 0, rotate: -12 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { scale: 0.7, opacity: 0, rotate: 10 }}
                      transition={{ type: "spring", stiffness: 320, damping: 22 }}
                      className="flex h-16 w-16 items-center justify-center rounded-2xl bg-saffron"
                    >
                      <ActiveIcon className="h-8 w-8 text-ink" aria-hidden="true" />
                    </motion.span>
                  </AnimatePresence>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="flex flex-col items-center"
                  >
                    {/* Staggered so the heading lands before the body, rather
                        than the whole block sliding as one slab. */}
                    <motion.span
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.05 }}
                      className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-saffron"
                    >
                      {String(active + 1).padStart(2, "0")} / {String(features.length).padStart(2, "0")}
                    </motion.span>
                    <motion.h4
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08, duration: 0.3, ease: "easeOut" }}
                      className="mt-3 text-xl font-semibold"
                    >
                      {features[active].heading}
                    </motion.h4>
                    <motion.p
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.16, duration: 0.3, ease: "easeOut" }}
                      className="mt-3 text-sm leading-relaxed text-cream-paper/80"
                    >
                      {features[active].body}
                    </motion.p>
                  </motion.div>
                </AnimatePresence>

                <div className="mt-8 flex flex-wrap justify-center gap-1.5">
                  {features.map((feature, index) => (
                    <span
                      key={feature.heading}
                      className={`h-1.5 rounded-full transition-all duration-300 ease-out ${
                        active === index ? "w-6 bg-saffron" : "w-1.5 bg-cream-paper/30"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
