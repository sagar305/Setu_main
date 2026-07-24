import type { Metadata } from "next";
import { GeneralLedgerTool } from "@/components/tools/bookkeeping/GeneralLedgerTool";

export const metadata: Metadata = {
  title: "Free General Ledger | Account-wise Running Balance | Setu Technology",
  description: "View any account's ledger with running balances, built automatically from your journal entries. Export to CSV. Free, offline, no signup.",
  keywords: ["general ledger", "ledger account online", "running balance ledger", "account ledger free", "bookkeeping ledger"],
  alternates: { canonical: "/tools/general-ledger" },
  openGraph: {
    title: "General Ledger",
    description: "View any account's ledger with running balances, built automatically from your journal entries. Export to CSV. Free, offline, no signup.",
    url: "/tools/general-ledger",
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
      name: "Where does the ledger data come from?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "From the Journal Entry tool on this site. Every posted entry appears in the ledger of each account it touches — no re-typing.",
      },
    },
    {
      "@type": "Question",
      name: "What does the Dr/Cr balance mean?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Asset and expense accounts normally carry debit (Dr) balances; liability, equity and income accounts carry credit (Cr) balances. The ledger shows the running balance on the account's normal side.",
      },
    },
    {
      "@type": "Question",
      name: "Can I export a ledger?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — export any account's ledger as CSV with dates, narrations, debits, credits and the running balance.",
      },
    }
  ],
};

export default function GeneralLedgerPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">General Ledger</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            Pick an account, see every posting and the running balance — built automatically from your journal.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <GeneralLedgerTool />
      </section>
    </>
  );
}
