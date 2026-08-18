"use client";

// The standing privacy statement (§19, §21). It is not decoration: everything
// it claims is enforced by the code — no fetch of statement data, no analytics,
// no server round-trip in the whole pipeline.

import { Lock } from "lucide-react";

export function PrivacyNote({ className = "" }: { className?: string }) {
  return (
    <p
      className={`inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 ${className}`}
    >
      <Lock className="h-4 w-4" aria-hidden="true" />
      Your statement is read in this browser. Nothing is uploaded.
    </p>
  );
}

export function ProcessingNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted ${className}`}>
      All parsing, classification and report generation happens on this device.
      Your data is stored locally in this browser and you can clear it at any time.
    </p>
  );
}
