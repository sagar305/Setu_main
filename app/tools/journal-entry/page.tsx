import type { Metadata } from "next";
import { JournalEntryTool } from "@/components/tools/bookkeeping/JournalEntryTool";

export const metadata: Metadata = {
  title: "Free Journal Entry Tool | Double-Entry Bookkeeping Online | Setu Technology",
  description: "Record double-entry journal entries with automatic debit/credit balancing. Feeds a general ledger and trial balance. Free, offline, no signup.",
  keywords: ["journal entry", "double entry bookkeeping", "accounting journal online", "debit credit entry", "bookkeeping journal free"],
  alternates: { canonical: "/tools/journal-entry" },
  openGraph: {
    title: "Journal Entry",
    description: "Record double-entry journal entries with automatic debit/credit balancing. Feeds a general ledger and trial balance. Free, offline, no signup.",
    url: "/tools/journal-entry",
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
      name: "How do debits and credits work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Every transaction touches at least two accounts, and total debits must equal total credits. Paying ₹10,000 rent by bank: debit Rent Expense ₹10,000, credit Bank ₹10,000. The tool blocks unbalanced entries.",
      },
    },
    {
      "@type": "Question",
      name: "Where do my entries go?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Into a journal stored in your browser. The General Ledger and Trial Balance tools read the same journal, so your books stay consistent across all three.",
      },
    },
    {
      "@type": "Question",
      name: "Can I export my journal?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — one click exports the full journal as CSV, ready for Excel, Google Sheets or your accountant.",
      },
    }
  ],
};

export default function JournalEntryPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Journal Entry</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            Proper double-entry bookkeeping — debits on the left, credits on the right, always balanced.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <JournalEntryTool />
      </section>
    </>
  );
}
