import type { Metadata } from "next";
import { StepNav } from "@/components/tools/BankStatementAnalyzer/StepNav";
import { ReconcileStep } from "@/components/tools/BankStatementAnalyzer/ReconcileStep";

// An application state, not indexable content — see the import step.
export const metadata: Metadata = {
  title: "Reconcile with your books | Setu",
  robots: { index: false, follow: true },
};

export default function ReconcilePage() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-ink">Bank Statement Analyzer</h1>
      <StepNav />
      <ReconcileStep />
    </section>
  );
}
