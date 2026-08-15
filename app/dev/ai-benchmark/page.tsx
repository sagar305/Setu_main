// Development-only: compare embedding models on labelled transactions.
// ---------------------------------------------------------------------------
// Not a product surface. `force-dynamic` keeps it out of the prerender, and the
// notFound() below means it does not exist at all in a production build — so a
// CA can never reach it and it costs them nothing.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AiBenchmarkRunner } from "@/components/tools/BankStatementAnalyzer/AiBenchmarkRunner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI model benchmark",
  robots: { index: false, follow: false },
};

export default function AiBenchmarkPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-ink">Embedding model benchmark</h1>
      <p className="mt-2 text-sm text-muted">
        Development only. Runs the same labelled transactions through every registered model using
        the real pipeline — the same normalisation, category profiles, scoring and thresholds — so
        the only difference measured is the model. Everything runs in this browser.
      </p>
      <AiBenchmarkRunner />
    </main>
  );
}
