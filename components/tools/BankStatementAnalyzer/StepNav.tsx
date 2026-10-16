"use client";

// The 1–5 stepper (decision 25). Steps are real sub-routes, so a CA can
// bookmark or refresh mid-workflow and land back where they were.

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/translate";
import { usePathname } from "next/navigation";
import { useAnalyzer } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";

const STEPS: { href: string; labelKey: TKey }[] = [
  { href: "/products/bank-statement-analyzer/import", labelKey: "bsStepImport" },
  { href: "/products/bank-statement-analyzer/review", labelKey: "bsStepReview" },
  { href: "/products/bank-statement-analyzer/analyze", labelKey: "bsStepAnalyze" },
  { href: "/products/bank-statement-analyzer/reconcile", labelKey: "bsStepReconcile" },
  { href: "/products/bank-statement-analyzer/export", labelKey: "bsStepExport" },
];

export function StepNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const { transactions, loaded } = useAnalyzer();
  const hasData = transactions.length > 0;
  // The product page hosts the import step itself, so the base route counts as
  // step 1 rather than leaving the stepper with nothing highlighted.
  const base = "/products/bank-statement-analyzer";
  const activeIndex =
    pathname === base ? 0 : STEPS.findIndex((step) => pathname === step.href);

  return (
    <nav aria-label={t("bsStepsAria")} className="mb-8">
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
              {t(step.labelKey)}
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
