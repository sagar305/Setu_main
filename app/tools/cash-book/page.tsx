import type { Metadata } from "next";
import { CashBookTool } from "@/components/tools/CashBook/CashBookTool";
import { SuggestedTools } from "@/components/toolkit/SuggestedTools";

export const metadata: Metadata = {
  title: "Free Cash Book | Daily Cash In/Out & Closing Balance | Setu Technology",
  description:
    "Simple daily cash book for your shop — record cash in and out, get opening and closing balances automatically. Free, offline, no signup.",
  keywords: [
    "cash book",
    "daily cash register",
    "cash in out book",
    "shop cash book free",
    "rojnamcha",
    "cash closing balance",
  ],
  alternates: { canonical: "/tools/cash-book" },
  openGraph: {
    title: "Free Daily Cash Book",
    description:
      "Record cash in/out and get opening & closing balances automatically. Offline, no signup.",
    url: "/tools/cash-book",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology Cash Book",
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
      name: "How are opening and closing balances calculated?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Automatically. The opening balance of any day is the running total of all earlier entries; the closing balance adds that day's cash in and subtracts cash out.",
      },
    },
    {
      "@type": "Question",
      name: "Is my cash data private?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — everything stays in your browser on your device. No signup, no cloud. Export the full book as CSV any time.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use it for previous days?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — pick any date when adding an entry and when viewing. Balances recalculate across the whole book.",
      },
    },
  ],
};

export default function CashBookPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Cash Book</h1>
          <p className="mt-4 text-xl text-muted">
            Daily cash in, cash out, and closing balance — the shop diary, minus the diary.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <CashBookTool />
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <SuggestedTools current="cash-book" />
      </section>
    </>
  );
}
