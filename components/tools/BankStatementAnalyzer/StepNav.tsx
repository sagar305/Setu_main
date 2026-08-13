"use client";

// The 1–5 stepper (decision 25). Steps are real sub-routes, so a CA can
// bookmark or refresh mid-workflow and land back where they were.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAnalyzer } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";

const STEPS = [
  { href: "/tools/bank-statement-analyzer/import", label: "Import" },
  { href: "/tools/bank-statement-analyzer/review", label: "Review" },
  { href: "/tools/bank-statement-analyzer/analyze", label: "Analyze" },
  { href: "/tools/bank-statement-analyzer/reconcile", label: "Reconcile" },
  { href: "/tools/bank-statement-analyzer/export", label: "Export" },
];

export function StepNav() {
  const pathname = usePathname();
  const { transactions, loaded } = useAnalyzer();
  const hasData = transactions.length > 0;
  const activeIndex = STEPS.findIndex((step) => pathname === step.href);

  return (
    <nav aria-label="Analyzer steps" className="mb-8">
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((step, index) => {
          const active = index === activeIndex;
          // Steps past Import need transactions to be meaningful.
          const locked = loaded && !hasData && index > 0;
          const className = active
            ? "border-indigo bg-indigo text-white"
            : locked
              ? "border-muted-line/30 bg-cream-paper/50 text-muted"
              : "border-muted-line/40 bg-white text-ink hover:border-indigo/40";

          const content = (
            <span className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                  active ? "bg-white/20 text-white" : "bg-cream text-indigo"
                }`}
              >
                {index + 1}
              </span>
              {step.label}
            </span>
          );

          return (
            <li key={step.href}>
              {locked ? (
                <span
                  aria-disabled="true"
                  className={`inline-flex cursor-not-allowed rounded-full border px-4 py-2 text-sm font-semibold ${className}`}
                >
                  {content}
                </span>
              ) : (
                <Link
                  href={step.href}
                  aria-current={active ? "step" : undefined}
                  className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold transition ${className}`}
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
