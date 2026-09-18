import type { Metadata } from "next";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { BudgetVsActualTool } from "@/components/tools/analysis/BudgetVsActualTool";
import { GlossaryTermsStrip } from "@/components/glossary/GlossaryTermsStrip";

export const metadata: Metadata = toolMetadata("budget-vs-actual");

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is budget variance?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The difference between actual and budgeted amounts (actual − budget). For expense rows a positive variance means overspend; for revenue rows it means you beat the plan.",
      },
    },
    {
      "@type": "Question",
      name: "Which variances should I investigate?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Big ones in money terms and big ones in percentage terms — a 2% miss on your largest cost can matter more than a 40% miss on a tiny one. Look at both columns.",
      },
    },
    {
      "@type": "Question",
      name: "How often should I review budget vs actual?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Monthly is the standard rhythm — soon enough to correct course, spaced enough for real data. Save the sheet each month and export CSVs for your records.",
      },
    }
  ],
};

export default function BudgetVsActualPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <section className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <div className="text-center">
          <div className="mb-4 inline-block rounded-full bg-indigo/10 px-4 py-2">
            <span className="text-sm font-semibold text-indigo">Free Tool</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Budget vs Actual</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            Plan vs reality, category by category — variances computed and colour-coded as you type.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <BudgetVsActualTool />
      </section>
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <GlossaryTermsStrip type="tool" slug="budget-vs-actual" />
      </section>
    </>
  );
}
