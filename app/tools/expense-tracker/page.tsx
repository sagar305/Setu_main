import type { Metadata } from "next";
import { ExpenseTrackerTool } from "@/components/tools/ExpenseTracker/ExpenseTrackerTool";
import { SuggestedTools } from "@/components/toolkit/SuggestedTools";

export const metadata: Metadata = {
  title: "Free Expense Tracker for Small Business | Setu Technology",
  description:
    "Track business expenses by category — rent, salaries, purchases, bills. Monthly totals, CSV export. Free, offline, no signup.",
  keywords: [
    "expense tracker",
    "business expense tracker free",
    "shop expense record",
    "expense register",
    "kharcha tracker",
  ],
  alternates: { canonical: "/tools/expense-tracker" },
  openGraph: {
    title: "Free Business Expense Tracker",
    description:
      "Track expenses by category with monthly totals and CSV export. Offline, no signup.",
    url: "/tools/expense-tracker",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology Expense Tracker",
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
      name: "Is this expense tracker really free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — free, unlimited entries, no signup. Your expense data stays in your browser on your device.",
      },
    },
    {
      "@type": "Question",
      name: "How does it connect to the Profit Dashboard?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Expenses you record here are automatically included in the Setu Profit Dashboard, so your profit is calculated from actual expenses — not estimates.",
      },
    },
    {
      "@type": "Question",
      name: "Can I export my expenses?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — export any month as a CSV file that opens in Excel or Google Sheets.",
      },
    },
  ],
};

export default function ExpenseTrackerPage() {
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
            Expense Tracker
          </h1>
          <p className="mt-4 text-xl text-muted">
            Record every business expense by category — and see your real profit on the dashboard.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <ExpenseTrackerTool />
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <SuggestedTools current="expense-tracker" />
      </section>
    </>
  );
}
