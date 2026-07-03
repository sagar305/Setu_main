"use client";

import type { ComponentType } from "react";
import {
  BookOpen,
  Receipt,
  ChefHat,
  QrCode,
  Boxes,
  Sparkles,
  Store,
  TrendingUp,
  Printer,
  WifiOff,
  Coins,
  Languages,
} from "lucide-react";
import type { QueueContent } from "@/lib/content";
import { FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";

const icons: Record<string, ComponentType<{ className?: string }>> = {
  "book-open": BookOpen,
  receipt: Receipt,
  "chef-hat": ChefHat,
  "qr-code": QrCode,
  boxes: Boxes,
  sparkles: Sparkles,
  store: Store,
  "trending-up": TrendingUp,
  printer: Printer,
  "wifi-off": WifiOff,
  coins: Coins,
  languages: Languages,
};

type Feature = QueueContent["features"][number];

// Per-feature icon hover animation — keyframes live in globals.css.
// Full class strings so Tailwind's JIT picks them up.
const hoverAnimations: Record<string, string> = {
  "book-open": "group-hover:animate-[icon-open_0.7s_ease-in-out]",
  receipt: "group-hover:animate-[icon-print_0.7s_ease-in-out]",
  "chef-hat": "group-hover:animate-[icon-serve_0.7s_ease-in-out]",
  "qr-code": "group-hover:animate-[icon-scan_0.9s_ease-in-out]",
  boxes: "group-hover:animate-[icon-shake_0.6s_ease-in-out]",
  sparkles: "group-hover:animate-[icon-sparkle_0.7s_ease-in-out]",
  store: "group-hover:animate-[icon-pop_0.6s_ease-in-out]",
  "trending-up": "group-hover:animate-[icon-rise_0.7s_ease-in-out]",
  printer: "group-hover:animate-[icon-print_0.7s_ease-in-out]",
  "wifi-off": "group-hover:animate-[icon-blink_0.9s_ease-in-out]",
  coins: "group-hover:animate-[icon-flip_0.7s_ease-in-out]",
  languages: "group-hover:animate-[icon-flip_0.7s_ease-in-out]",
};

export function QueueShowcase({ features }: { features: Feature[] }) {
  return (
    <section className="pb-20 pt-10">
      <div className="mx-auto max-w-6xl px-6">
        <FadeInStagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => {
            const Icon = icons[feature.icon];
            return (
              <FadeInStaggerItem
                key={feature.heading}
                className="group flex flex-col rounded-2xl border border-muted-line/30 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-saffron hover:shadow-lg hover:shadow-ink/5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo transition-colors group-hover:bg-saffron">
                    <Icon
                      className={`h-5 w-5 text-cream-paper transition-colors group-hover:text-ink ${hoverAnimations[feature.icon] ?? ""}`}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-warm">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-bold tracking-tight text-ink">{feature.heading}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
              </FadeInStaggerItem>
            );
          })}
        </FadeInStagger>
      </div>
    </section>
  );
}
