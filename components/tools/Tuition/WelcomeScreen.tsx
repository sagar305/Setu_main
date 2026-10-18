"use client";

import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/translate";
import { useRef, useState } from "react";
import { GraduationCap, Lock, Sheet, Upload, WifiOff } from "lucide-react";
import { useTuition } from "@/lib/tuition/store";
import { parseBackupFile } from "@/lib/tuition/backup";
import { inputClass, primaryBtnClass, secondaryBtnClass } from "@/components/tools/FreePos/ui";

const POINTS: { icon: typeof WifiOff; key: TKey }[] = [
  { icon: WifiOff, key: "tuWelPointOffline" },
  { icon: Lock, key: "tuWelPointPrivate" },
  { icon: Sheet, key: "tuWelPointSheet" },
];

export function WelcomeScreen() {
  const { t } = useI18n();
  const { startSetup, applyRestoredBackup, restoreFromSheet } = useTuition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetRestoring, setSheetRestoring] = useState(false);

  const handleSheetRestore = async () => {
    setImportError("");
    setSheetRestoring(true);
    try {
      await restoreFromSheet(sheetUrl);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : t("tuWelSheetFailed")
      );
    } finally {
      setSheetRestoring(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setImportError("");
    setImporting(true);
    try {
      const result = parseBackupFile(await file.text());
      if (!result.ok) {
        setImportError(t(result.error));
        return;
      }
      await applyRestoredBackup(result.backup);
    } catch {
      setImportError(t("appRestoreFailed"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl py-10 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo text-white">
        <GraduationCap className="h-8 w-8" />
      </span>
      <h2 className="mt-6 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        {t("tuWelTitle")}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-muted">
        {t("tuWelBlurb")}
      </p>

      <ul className="mx-auto mt-8 grid max-w-md gap-3 text-left">
        {POINTS.map((point) => (
          <li
            key={point.key}
            className="flex items-center gap-3 rounded-xl border border-muted-line/30 bg-white px-4 py-3"
          >
            <point.icon className="h-4 w-4 shrink-0 text-indigo" />
            <span className="text-sm text-ink">{t(point.key)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-center gap-3">
        <button type="button" onClick={startSetup} className={`${primaryBtnClass} w-full max-w-xs py-3`}>
          {t("tuWelSetUp")}
        </button>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className={secondaryBtnClass}
          >
            <Upload className="h-4 w-4" />
            {importing ? t("appRestoring") : t("appRestoreABackup")}
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen((prev) => !prev)}
            className={secondaryBtnClass}
          >
            <Sheet className="h-4 w-4" />
            {t("tuWelRestoreSheet")}
          </button>
        </div>

        {sheetOpen && (
          <div className="w-full max-w-md rounded-xl border border-muted-line/30 bg-white p-4 text-left">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
              {t("tuWelSheetUrl")}
            </label>
            <input
              type="url"
              value={sheetUrl}
              onChange={(event) => setSheetUrl(event.target.value)}
              placeholder="https://script.google.com/macros/s/…/exec"
              className={`${inputClass} mt-1`}
            />
            <button
              type="button"
              onClick={() => void handleSheetRestore()}
              disabled={sheetRestoring || !sheetUrl.trim()}
              className={`${primaryBtnClass} mt-3 w-full`}
            >
              {sheetRestoring ? t("appRestoring") : t("tuWelRestoreThisSheet")}
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImportFile(file);
            event.target.value = "";
          }}
        />

        {importError && (
          <p className="max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {importError}
          </p>
        )}
      </div>
    </div>
  );
}
