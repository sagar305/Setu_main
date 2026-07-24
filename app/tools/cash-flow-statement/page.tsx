import type { Metadata } from "next";
import { CashFlowTool } from "@/components/tools/statements/CashFlowTool";

export const metadata: Metadata = {
  title: "Free Cash Flow Statement Maker | Operating, Investing, Financing | Setu Technology",
  description: "Build a cash flow statement across operating, investing and financing activities. Opening to closing cash, print to PDF, CSV export. Free, no signup.",
  keywords: ["cash flow statement", "cash flow format", "cash flow online free", "operating investing financing", "small business cash flow"],
  alternates: { canonical: "/tools/cash-flow-statement" },
  openGraph: {
    title: "Cash Flow Statement",
    description: "Build a cash flow statement across operating, investing and financing activities. Opening to closing cash, print to PDF, CSV export. Free, no signup.",
    url: "/tools/cash-flow-statement",
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
      name: "Why track cash flow separately from profit?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Profit is an opinion, cash is a fact: a profitable business can still run out of cash if money is stuck in stock or unpaid invoices. The cash flow statement shows the actual movement.",
      },
    },
    {
      "@type": "Question",
      name: "What goes in each section?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Operating: day-to-day trading (customer receipts, supplier and salary payments). Investing: buying or selling assets. Financing: loans taken or repaid, capital introduced, drawings.",
      },
    },
    {
      "@type": "Question",
      name: "How do I enter outflows?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "As negative numbers — e.g. −25000 for equipment purchased. Each section then nets itself and the statement runs from opening cash to closing cash.",
      },
    }
  ],
};

export default function CashFlowStatementPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Cash Flow Statement</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            Where cash came from and where it went — operating, investing and financing, from opening to closing balance.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <CashFlowTool />
      </section>
    </>
  );
}
