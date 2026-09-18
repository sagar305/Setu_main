import type { Metadata } from "next";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { JournalEntryTool } from "@/components/tools/bookkeeping/JournalEntryTool";
import { GlossaryTermsStrip } from "@/components/glossary/GlossaryTermsStrip";

export const metadata: Metadata = toolMetadata("journal-entry");

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
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <GlossaryTermsStrip type="tool" slug="journal-entry" />
      </section>
    </>
  );
}
