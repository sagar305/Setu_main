import type { Metadata } from "next";
import { ProfitLossTool } from "@/components/tools/statements/ProfitLossTool";

export const metadata: Metadata = {
  title: "Free Profit & Loss Statement Maker | P&L Online | Setu Technology",
  description: "Build a profit & loss statement — revenue, COGS, expenses, gross/operating/net profit with margins. Print to PDF or export CSV. Free, no signup.",
  keywords: ["profit and loss statement", "P&L maker", "income statement online", "profit loss format", "free P&L template"],
  alternates: { canonical: "/tools/profit-loss-statement" },
  openGraph: {
    title: "Profit & Loss Statement",
    description: "Build a profit & loss statement — revenue, COGS, expenses, gross/operating/net profit with margins. Print to PDF or export CSV. Free, no signup.",
    url: "/tools/profit-loss-statement",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology - Setu for your business",
      },
    ],
  },
};

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
    </>
  );
}
