"use client";

import { useRef, useState } from "react";
import { CalendarRange, Lock, PackageCheck, Upload, WifiOff } from "lucide-react";
import { useRental } from "@/lib/rental/store";
import { parseBackupFile } from "@/lib/rental/backup";
import { primaryBtnClass, secondaryBtnClass } from "./ui";

const POINTS = [
  { icon: CalendarRange, text: "Shows exactly how many are free on any date, before you promise them" },
  { icon: PackageCheck, text: "Settles damage, shortage and late fees against the deposit at return" },
  { icon: WifiOff, text: "Works offline — the godown has no signal and the app does not care" },
  { icon: Lock, text: "No signup. Nothing leaves this device unless you send it" },
];

export function WelcomeScreen() {
  const { startSetup, applyRestoredBackup } = useRental();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);

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
        <CalendarRange className="h-8 w-8" />
      </span>
      <h2 className="mt-6 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        Never promise the same 200 chairs twice
      </h2>
      <p className="mx-auto mt-3 max-w-md text-muted">
        A hire book that knows what is already committed on every date — so when someone asks
        for the 14th, you can answer in seconds and be right.
      </p>

      <ul className="mx-auto mt-8 grid max-w-md gap-3 text-left">
        {POINTS.map((point) => (
          <li
            key={point.text}
            className="flex items-start gap-3 rounded-xl border border-muted-line/30 bg-white p-3"
          >
            <point.icon className="mt-0.5 h-5 w-5 shrink-0 text-indigo" aria-hidden="true" />
            <span className="text-sm text-ink">{point.text}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <button type="button" onClick={startSetup} className={primaryBtnClass}>
          Set up my hire book
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={secondaryBtnClass}
          disabled={importing}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {importing ? "Restoring…" : "Restore a backup"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImportFile(file);
            event.target.value = "";
          }}
        />
      </div>

      {importError && (
        <p className="mt-4 text-sm font-semibold text-red-600" role="alert">
          {importError}
        </p>
      )}

      <p className="mx-auto mt-8 max-w-md text-xs text-muted">
        Already using another Setu tool on this device? Your business details carry over — you
        will not be asked for them twice.
      </p>
    </div>
  );
}
