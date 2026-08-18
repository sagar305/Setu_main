"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useDine } from "@/lib/dine/store";
import { parseDineBackupFile } from "@/lib/dine/backup";

/**
 * Restore from a backup file. Lives on both the welcome screen (a user whose
 * browser data was cleared has nothing else to click) and in Settings.
 */
export function RestoreBackupButton({
  className,
  label = "Restore from backup",
}: {
  className: string;
  label?: string;
}) {
  const { applyRestoredBackup } = useDine();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const result = parseDineBackupFile(await file.text());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await applyRestoredBackup(result.backup);
    } catch {
      setError("Could not read that file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={className}
      >
        <Upload className="h-4 w-4" />
        {busy ? "Restoring…" : label}
      </button>
      {error && <p className="max-w-xs text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
