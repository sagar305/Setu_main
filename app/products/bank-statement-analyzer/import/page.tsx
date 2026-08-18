import type { Metadata } from "next";
import { Suspense } from "react";
import { StepNav } from "@/components/tools/BankStatementAnalyzer/StepNav";
import { ImportStep } from "@/components/tools/BankStatementAnalyzer/ImportStep";

// The workflow steps are application states, not content — they carry no
// indexable copy of their own and the landing page is the canonical entry
// point, so they are marked noindex.
export const metadata: Metadata = {
  title: "Import a bank statement | Setu",
  robots: { index: false, follow: true },
};

export default function ImportPage() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-ink">Bank Statement Analyzer</h1>
      <StepNav />
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <ImportStep />
      </Suspense>
    </section>
  );
}
