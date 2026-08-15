// Development-only: compare embedding models on labelled transactions.
// ---------------------------------------------------------------------------
// Not a product surface. notFound() below means the route does not exist in a
// production build, so a CA can never reach it.
//
// It must stay STATIC. Marking it dynamic makes it a serverless function, and a
// function's file trace follows this page's imports down to
// @huggingface/transformers and therefore to onnxruntime-node — 211 MB of
// native binaries that only ever run in a browser. That produced a 394 MB
// function and broke deployment. Prerendered, it resolves to a 404 at build
// time and no function is emitted at all.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AiBenchmarkRunner } from "@/components/tools/BankStatementAnalyzer/AiBenchmarkRunner";

export const dynamic = "force-static";

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
