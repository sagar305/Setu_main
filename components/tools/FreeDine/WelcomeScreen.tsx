"use client";

import { HardDrive, Receipt, UtensilsCrossed, WifiOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/translate";
import { useDine } from "@/lib/dine/store";
import { primaryBtnClass, secondaryBtnClass } from "./ui";
import { RestoreBackupButton } from "./RestoreBackupButton";

const POINTS: { icon: typeof Receipt; title: TKey; body: TKey }[] = [
  { icon: Receipt, title: "dnWelPt1Title", body: "dnWelPt1Body" },
  { icon: WifiOff, title: "dnWelPt2Title", body: "dnWelPt2Body" },
  { icon: HardDrive, title: "dnWelPt3Title", body: "dnWelPt3Body" },
];

export function WelcomeScreen() {
  const { t } = useI18n();
  const { startSetup } = useDine();

  return (
    <div className="mx-auto max-w-2xl py-10 text-center sm:py-16">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo text-white">
        <UtensilsCrossed className="h-7 w-7" />
      </span>
      <h2 className="mt-5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        {t("dnWelTagline")}
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm text-muted">{t("dnWelIntro")}</p>

      <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
        {POINTS.map((point) => (
          <div
            key={point.title}
            className="rounded-2xl border border-muted-line/30 bg-white p-4 shadow-sm"
          >
            <point.icon className="h-5 w-5 text-indigo" />
            <h3 className="mt-3 text-sm font-bold text-ink">{t(point.title)}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">{t(point.body)}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button type="button" onClick={startSetup} className={primaryBtnClass}>
          {t("dnWelSetUp")}
        </button>
        <RestoreBackupButton className={secondaryBtnClass} label={t("dnWelRestoreFromBackup")} />
      </div>

      <p className="mx-auto mt-6 max-w-md text-xs leading-relaxed text-muted/80">
        {t("dnWelKeptSeparate")}
      </p>
    </div>
  );
}
