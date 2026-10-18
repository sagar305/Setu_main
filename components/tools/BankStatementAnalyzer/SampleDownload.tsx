"use client";

// Download the synthetic sample statement as a real file.
// ---------------------------------------------------------------------------
// "Try a demo statement" loads data straight into the app, which skips the
// parser entirely. Downloading the sample and importing it exercises the real
// path — and gives a CA something safe to test with, or to hand to a colleague,
// without touching a client's file.

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { Download, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { SecondaryButton } from "@/components/toolkit/ui";
import {
  downloadSampleCsv,
  downloadSamplePdf,
  downloadSampleXlsx,
} from "@/lib/bankStatement/demo/sampleFiles";
import { DEMO_TOTALS } from "@/lib/bankStatement/demo/sampleStatement";

type Format = "pdf" | "xlsx" | "csv";

// The format names are the file types themselves, so they stay as they are.
const FORMATS: { key: Format; label: string; icon: typeof FileText; run: () => void }[] = [
  { key: "pdf", label: "PDF", icon: FileText, run: downloadSamplePdf },
  { key: "xlsx", label: "Excel", icon: FileSpreadsheet, run: downloadSampleXlsx },
  { key: "csv", label: "CSV", icon: Table2, run: downloadSampleCsv },
];

export function SampleDownload({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<Format | null>(null);

  const download = (format: Format, run: () => void) => {
    setBusy(format);
    try {
      run();
    } finally {
      setBusy(null);
    }
  };

  const buttons = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {FORMATS.map((format) => {
        const Icon = format.icon;
        return (
          <SecondaryButton
            key={format.key}
            onClick={() => download(format.key, format.run)}
            disabled={busy !== null}
            className="inline-flex items-center gap-2"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {busy === format.key
              ? t("bsSampBuilding")
              : fill(t("bsSampFormat"), { format: format.label })}
          </SecondaryButton>
        );
      })}
    </div>
  );

  if (compact) {
    return (
      <div className="text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {t("bsSampOrDownload")}
        </p>
        {buttons}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold text-ink">
        <Download className="h-4 w-4 text-indigo" aria-hidden="true" />
        {t("bsSampDownloadTitle")}
      </div>
      {buttons}
      <p className="mx-auto mt-3 max-w-md text-xs text-muted">
        {fill(t("bsSampBlurb"), { n: DEMO_TOTALS.count })}
      </p>
    </div>
  );
}
