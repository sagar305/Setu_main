import type { Metadata } from "next";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ProfitLossTool } from "@/components/tools/statements/ProfitLossTool";
import { GlossaryTermsStrip } from "@/components/glossary/GlossaryTermsStrip";

export const metadata: Metadata = toolMetadata("profit-loss-statement");

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What goes in a profit & loss statement?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Revenue, minus cost of goods sold (gross profit), minus operating expenses (operating profit), plus other income, minus tax — leaving net profit. This tool computes every level as you type.",
      },
    },
    {
      "@type": "Question",
      name: "What's the difference between gross and net margin?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Gross margin shows how profitable your core product is before overheads; net margin shows what actually remains after everything. A healthy gross margin with a thin net margin points at overheads.",
      },
    },
    {
      "@type": "Question",
      name: "Can I print or share the statement?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — print a clean A4 statement (or save as PDF from the print dialog) and export the underlying numbers as CSV. Data stays in your browser.",
      },
    }
  ],
};

export default function ProfitLossStatementPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Profit & Loss Statement</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            Revenue at the top, net profit at the bottom, every step in between — with margins computed live.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <ProfitLossTool />
      </section>
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <GlossaryTermsStrip type="tool" slug="profit-loss-statement" />
      </section>
    </>
  );
}
