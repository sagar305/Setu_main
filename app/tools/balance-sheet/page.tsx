import type { Metadata } from "next";
import { BalanceSheetTool } from "@/components/tools/statements/BalanceSheetTool";

export const metadata: Metadata = {
  title: "Free Balance Sheet Maker | Assets = Liabilities + Equity | Setu Technology",
  description: "Build a balance sheet with current/fixed assets, liabilities and equity. Live balance check, A4 print, CSV export. Free, no signup.",
  keywords: ["balance sheet maker", "balance sheet format", "balance sheet online free", "assets liabilities equity", "small business balance sheet"],
  alternates: { canonical: "/tools/balance-sheet" },
  openGraph: {
    title: "Balance Sheet",
    description: "Build a balance sheet with current/fixed assets, liabilities and equity. Live balance check, A4 print, CSV export. Free, no signup.",
    url: "/tools/balance-sheet",
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
      name: "What is a balance sheet?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A snapshot at a date: assets (what the business owns), liabilities (what it owes) and equity (the owners' share). Assets must equal liabilities plus equity.",
      },
    },
    {
      "@type": "Question",
      name: "Why doesn't my balance sheet balance?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The most common cause is missing retained earnings — accumulated past profit belongs in equity. The tool shows the exact difference so you can find the gap.",
      },
    },
    {
      "@type": "Question",
      name: "What's the difference between current and fixed assets?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Current assets convert to cash within a year (cash, receivables, stock); fixed assets serve the business longer (equipment, furniture, vehicles). Liabilities split the same way by when they fall due.",
      },
    }
  ],
};

export default function BalanceSheetPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Balance Sheet</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            What you own, what you owe, and what&apos;s left for the owners — checked live so it always balances.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <BalanceSheetTool />
      </section>
    </>
  );
}
