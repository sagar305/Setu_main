"use client";

import { useRef, useState } from "react";
import { GraduationCap, Lock, Sheet, Upload, WifiOff } from "lucide-react";
import { useTuition } from "@/lib/tuition/store";
import { parseBackupFile } from "@/lib/tuition/backup";
import { inputClass, primaryBtnClass, secondaryBtnClass } from "@/components/tools/FreePos/ui";

const POINTS = [
  { icon: WifiOff, text: "Works offline — mark attendance without internet" },
  { icon: Lock, text: "No signup. Everything stays on this device" },
  { icon: Sheet, text: "Optional Google Sheet sync as your backup" },
];

export function WelcomeScreen() {
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
        <GraduationCap className="h-8 w-8" />
      </span>
      <h2 className="mt-6 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        Your tuition class, organised
      </h2>
      <p className="mx-auto mt-3 max-w-md text-muted">
        Students, daily attendance, fees, test marks and parent reminders — set up in under a
        minute, and it keeps working without internet.
      </p>

      <ul className="mx-auto mt-8 grid max-w-md gap-3 text-left">
        {POINTS.map((point) => (
          <li
            key={point.text}
            className="flex items-center gap-3 rounded-xl border border-muted-line/30 bg-white px-4 py-3"
          >
            <point.icon className="h-4 w-4 shrink-0 text-indigo" />
            <span className="text-sm text-ink">{point.text}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-center gap-3">
        <button type="button" onClick={startSetup} className={`${primaryBtnClass} w-full max-w-xs py-3`}>
          Set up my class
        </button>

        <div className="flex flex-wrap items-center justify-center gap-2">
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
            onClick={() => setSheetOpen((prev) => !prev)}
            className={secondaryBtnClass}
          >
            <Sheet className="h-4 w-4" />
            Restore from Google Sheet
          </button>
        </div>

        {sheetOpen && (
          <div className="w-full max-w-md rounded-xl border border-muted-line/30 bg-white p-4 text-left">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
              Apps Script web app URL
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
              {sheetRestoring ? "Restoring…" : "Restore from this sheet"}
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
