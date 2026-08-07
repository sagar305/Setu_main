"use client";

import { HardDrive, Receipt, UtensilsCrossed, WifiOff } from "lucide-react";
import { useDine } from "@/lib/dine/store";
import { primaryBtnClass, secondaryBtnClass } from "./ui";
import { RestoreBackupButton } from "./RestoreBackupButton";

const POINTS = [
  {
    icon: Receipt,
    title: "Free forever, for one restaurant",
    body: "Tables, KOT, split bills, GST and reports. Not a trial, and nothing is switched off after a month.",
  },
  {
    icon: WifiOff,
    title: "Works with the wifi down",
    body: "Everything runs in this browser. Take orders and print bills through an outage.",
  },
  {
    icon: HardDrive,
    title: "No signup, no account",
    body: "Your menu and sales stay on this device. Nothing is uploaded and nobody else can read it.",
  },
];

export function WelcomeScreen() {
  const { startSetup } = useDine();

  return (
    <div className="mx-auto max-w-2xl py-10 text-center sm:py-16">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo text-white">
        <UtensilsCrossed className="h-7 w-7" />
      </span>
      <h2 className="mt-5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        Set up your restaurant in under a minute
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm text-muted">
        Tell us the restaurant&apos;s name and start taking orders. You can add the rest — GSTIN,
        logo, your real menu — whenever you have a quiet moment.
      </p>

      <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
        {POINTS.map((point) => (
          <div
            key={point.title}
            className="rounded-2xl border border-muted-line/30 bg-white p-4 shadow-sm"
          >
            <point.icon className="h-5 w-5 text-indigo" />
            <h3 className="mt-3 text-sm font-bold text-ink">{point.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">{point.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button type="button" onClick={startSetup} className={primaryBtnClass}>
          Set up my restaurant
        </button>
        <RestoreBackupButton className={secondaryBtnClass} label="Restore from a backup" />
      </div>

      <p className="mx-auto mt-6 max-w-md text-xs leading-relaxed text-muted/80">
        Free Dine keeps its data separate from the Browser Based POS — a retail counter and a
        dining room need different menus and different bill numbers, so the two never share.
      </p>
    </div>
  );
}
