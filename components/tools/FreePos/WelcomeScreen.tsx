"use client";

import { useRef, useState } from "react";
import { ShoppingCart, Upload, WifiOff, Lock, IndianRupee } from "lucide-react";
import { usePos } from "@/lib/pos/store";
import { parseBackupFile } from "@/lib/pos/backup";
import { primaryBtnClass, secondaryBtnClass } from "./ui";

export function WelcomeScreen() {
  const { startSetup, applyRestoredBackup } = usePos();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);

  const handleImportFile = async (file: File) => {
    setImportError("");
    setImporting(true);
    try {
      const text = await file.text();
      const result = parseBackupFile(text);
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
        <ShoppingCart className="h-8 w-8" />
      </span>
      <h2 className="mt-6 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        Welcome to your free POS
      </h2>
      <p className="mx-auto mt-3 max-w-md text-muted">
        Set up your counter in under a minute. Everything is saved on this
        device — no account, no internet needed.
      </p>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button type="button" onClick={startSetup} className={`${primaryBtnClass} px-6 py-3`}>
          Create new POS
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className={`${secondaryBtnClass} px-6 py-3`}
        >
          <Upload className="h-4 w-4" />
          {importing ? "Restoring…" : "Import backup"}
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
        <p className="mx-auto mt-4 max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {importError}
        </p>
      )}

      <div className="mt-12 grid gap-4 text-left sm:grid-cols-3">
        <div className="rounded-2xl border border-muted-line/30 bg-white p-5">
          <WifiOff className="h-5 w-5 text-indigo" />
          <h3 className="mt-3 text-sm font-bold text-ink">Works offline</h3>
          <p className="mt-1 text-xs text-muted">
            Bill customers even without internet. Data lives in your browser.
          </p>
        </div>
        <div className="rounded-2xl border border-muted-line/30 bg-white p-5">
          <Lock className="h-5 w-5 text-indigo" />
          <h3 className="mt-3 text-sm font-bold text-ink">No login, no cloud</h3>
          <p className="mt-1 text-xs text-muted">
            Your sales never leave this device. Export a backup anytime.
          </p>
        </div>
        <div className="rounded-2xl border border-muted-line/30 bg-white p-5">
          <IndianRupee className="h-5 w-5 text-indigo" />
          <h3 className="mt-3 text-sm font-bold text-ink">Built for small shops</h3>
          <p className="mt-1 text-xs text-muted">
            Products, billing, customers, receipts and reports — free forever.
          </p>
        </div>
      </div>
    </div>
  );
}
