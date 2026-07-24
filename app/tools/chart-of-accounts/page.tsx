import type { Metadata } from "next";
import { ChartOfAccountsTool } from "@/components/tools/bookkeeping/ChartOfAccountsTool";

export const metadata: Metadata = {
  title: "Free Chart of Accounts Builder | Small Business COA | Setu Technology",
  description: "Build your chart of accounts from a ready-made small-business template. Add, code and categorise accounts, export to CSV. Free, no signup.",
  keywords: ["chart of accounts", "COA template", "chart of accounts for small business", "account codes", "bookkeeping accounts list"],
  alternates: { canonical: "/tools/chart-of-accounts" },
  openGraph: {
    title: "Chart of Accounts",
    description: "Build your chart of accounts from a ready-made small-business template. Add, code and categorise accounts, export to CSV. Free, no signup.",
    url: "/tools/chart-of-accounts",
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
      name: "What is a chart of accounts?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The master list of every account your business records money against — assets, liabilities, equity, income and expenses. Every journal entry posts to accounts from this list.",
      },
    },
    {
      "@type": "Question",
      name: "What do the account codes mean?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A common convention: 1000s for assets, 2000s liabilities, 3000s equity, 4000s income, 5000s expenses. Numbering leaves gaps so you can slot new accounts in later.",
      },
    },
    {
      "@type": "Question",
      name: "Does this connect to the other bookkeeping tools?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — the Journal Entry, General Ledger and Trial Balance tools on this site read this same chart automatically, all inside your browser.",
      },
    }
  ],
};

export default function ChartOfAccountsPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Chart of Accounts</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            The backbone of your books — a ready-made account list you can shape to your business.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <ChartOfAccountsTool />
      </section>
    </>
  );
}
