"use client";

import { useRef, useState } from "react";
import { Lock, Sheet, Stethoscope, Upload, WifiOff } from "lucide-react";
import { useClinic } from "@/lib/clinic/store";
import { parseBackupFile } from "@/lib/clinic/backup";
import { inputClass, primaryBtnClass, secondaryBtnClass } from "@/components/tools/FreePos/ui";

const POINTS = [
  { icon: WifiOff, text: "Works offline — see patients even when the internet is down" },
  { icon: Lock, text: "No signup. Patient records never leave this device" },
  { icon: Sheet, text: "Optional Google Sheet sync as your backup" },
];

export function WelcomeScreen() {
  const { startSetup, applyRestoredBackup, restoreFromSheet } = useClinic();
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
        error instanceof Error ? error.message : "Could not restore from this sheet."
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
        setImportError(result.error);
        return;
      }
      await applyRestoredBackup(result.backup);
    } catch {
      setImportError("Could not restore this backup. The file may be corrupted.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl py-10 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo text-white">
        <Stethoscope className="h-8 w-8" />
      </span>
      <h2 className="mt-6 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        Your clinic, without the paper
      </h2>
      <p className="mx-auto mt-3 max-w-md text-muted">
        Patient records, a prescription pad that prints properly, appointments and billing — set
        up in under a minute, and it keeps working without internet.
      </p>

      <ul className="mx-auto mt-8 grid max-w-md gap-3 text-left">
        {POINTS.map((point) => (
          <li
            key={point.text}
            className="flex items-center gap-3 rounded-xl border border-muted-line/30 bg-white px-4 py-3"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream text-indigo">
              <point.icon className="h-4 w-4" />
            </span>
            <span className="text-sm text-ink">{point.text}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-center gap-3">
        <button type="button" onClick={startSetup} className={primaryBtnClass}>
          Set up my clinic
        </button>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className={secondaryBtnClass}
          >
            <Upload className="h-4 w-4" />
            {importing ? "Restoring…" : "Restore a backup"}
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen((open) => !open)}
            className={secondaryBtnClass}
          >
            <Sheet className="h-4 w-4" />
            Restore from Google Sheet
          </button>
        </div>

        {sheetOpen && (
          <div className="mt-2 w-full max-w-md space-y-2 text-left">
            <input
              type="url"
              value={sheetUrl}
              onChange={(event) => setSheetUrl(event.target.value)}
              placeholder="https://script.google.com/macros/s/…/exec"
              className={inputClass}
            />
            <button
              type="button"
              onClick={handleSheetRestore}
              disabled={sheetRestoring || !sheetUrl.trim()}
              className={primaryBtnClass}
            >
              {sheetRestoring ? "Restoring…" : "Restore"}
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleImportFile(file);
            event.target.value = "";
          }}
        />

        {importError && <p className="text-sm text-red-600">{importError}</p>}
      </div>
    </div>
  );
}
