import type { Metadata } from "next";
import { ProfitDashboardTool } from "@/components/tools/ProfitDashboard/ProfitDashboardTool";
import { SuggestedTools } from "@/components/toolkit/SuggestedTools";

export const metadata: Metadata = {
  title: "Free Profit Dashboard | Real Profit from Sales & Expenses | Setu Technology",
  description:
    "See your real business profit — revenue from your POS sales, minus cost of goods and actual expenses. Charts, date ranges, offline, no signup.",
  keywords: [
    "profit dashboard",
    "business profit calculator",
    "shop profit tracker",
    "net profit small business",
    "profit and loss free",
  ],
  alternates: { canonical: "/tools/profit-dashboard" },
  openGraph: {
    title: "Free Profit Dashboard — Real Profit, Real Numbers",
    description:
      "Revenue minus cost of goods minus actual expenses — computed from your own data, on your device.",
    url: "/tools/profit-dashboard",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology Profit Dashboard",
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
      name: "How is profit calculated?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Net profit = revenue − cost of goods − expenses. Revenue comes from your Browser POS sales, cost of goods from each product's cost price, and expenses from the Expense Tracker — all on your device.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need to enter data twice?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. The dashboard reads the sales you already billed in the POS and the expenses you already recorded in the Expense Tracker. Nothing to re-enter, nothing to configure.",
      },
    },
    {
      "@type": "Question",
      name: "Is my financial data uploaded?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Never. All calculations happen in your browser on your device. No signup, no cloud, no server.",
      },
    },
  ],
};

export default function ProfitDashboardPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Profit Dashboard
          </h1>
          <p className="mt-4 text-xl text-muted">
            Your real profit — sales minus cost of goods minus actual expenses. No estimates.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <ProfitDashboardTool />
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <SuggestedTools current="profit-dashboard" />
      </section>
    </>
  );
}
