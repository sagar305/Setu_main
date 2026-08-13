import type { Metadata } from "next";
import { StepNav } from "@/components/tools/BankStatementAnalyzer/StepNav";
import { AnalyzeStep } from "@/components/tools/BankStatementAnalyzer/AnalyzeStep";

// An application state, not indexable content — see the import step.
export const metadata: Metadata = {
  title: "Analyze statements | Setu",
  robots: { index: false, follow: true },
};

export default function AnalyzePage() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-ink">Bank Statement Analyzer</h1>
      <StepNav />
      <AnalyzeStep />
    </section>
  );
}
