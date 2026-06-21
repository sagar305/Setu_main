"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { motion, AnimatePresence, useInView } from "motion/react";
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
  const Icon = icons[feature.icon];

  useEffect(() => {
    if (inView) {
      onActivate(index);
    }
  }, [inView, index, onActivate]);

  return (
    <div
      ref={ref}
      className={`flex min-h-[50vh] items-center gap-5 border-l-2 pl-6 transition-colors md:min-h-[55vh] ${
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
    </div>
  );
}

export function RestaurantPosShowcase({ features }: { features: Feature[] }) {
  const [active, setActive] = useState(0);
  const ActiveIcon = icons[features[active].icon];

  return (
    <section className="bg-white py-12">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-[1fr_320px]">
        <div>
          {features.map((feature, index) => (
            <FeatureRow key={feature.heading} feature={feature} index={index} active={active === index} onActivate={setActive} />
          ))}
        </div>

        <div className="hidden md:block">
          <div className="sticky top-1/2 flex -translate-y-1/2 flex-col items-center rounded-3xl bg-indigo p-10 text-center text-cream-paper">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.96 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="flex flex-col items-center"
              >
                <motion.span
                  initial={{ rotate: -8 }}
                  animate={{ rotate: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="flex h-16 w-16 items-center justify-center rounded-2xl bg-saffron"
                >
                  <ActiveIcon className="h-8 w-8 text-ink" aria-hidden="true" />
                </motion.span>
                <h4 className="mt-6 text-xl font-semibold">{features[active].heading}</h4>
                <p className="mt-3 text-sm leading-relaxed text-cream-paper/80">{features[active].body}</p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex gap-1.5">
              {features.map((feature, index) => (
                <span
                  key={feature.heading}
                  className={`h-1.5 rounded-full transition-all ${
                    active === index ? "w-6 bg-saffron" : "w-1.5 bg-cream-paper/30"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
