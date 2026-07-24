import type { Metadata } from "next";
import { TrialBalanceTool } from "@/components/tools/bookkeeping/TrialBalanceTool";

export const metadata: Metadata = {
  title: "Free Trial Balance Generator | Auto-Built from Your Journal | Setu Technology",
  description: "A trial balance built automatically from your journal entries — every account's net debit or credit balance, totalled and checked. Free, no signup.",
  keywords: ["trial balance", "trial balance format", "trial balance online", "debit credit balance check", "bookkeeping trial balance"],
  alternates: { canonical: "/tools/trial-balance" },
  openGraph: {
    title: "Trial Balance",
    description: "A trial balance built automatically from your journal entries — every account's net debit or credit balance, totalled and checked. Free, no signup.",
    url: "/tools/trial-balance",
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
      name: "What is a trial balance?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A list of every account with a non-zero balance, shown on its debit or credit side. If your double-entry postings are correct, total debits equal total credits.",
      },
    },
    {
      "@type": "Question",
      name: "Where do the numbers come from?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "From the Journal Entry tool on this site — the trial balance recomputes automatically from your posted entries, using your Chart of Accounts.",
      },
    },
    {
      "@type": "Question",
      name: "What if it doesn't balance?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "With this tool it always should, because unbalanced journal entries can't be posted. If you imported or edited data elsewhere, the difference banner tells you how far apart the sides are.",
      },
    }
  ],
};

export default function TrialBalancePage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Trial Balance</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            Every account's net balance on its debit or credit side — totalled, checked, and ready to export.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <TrialBalanceTool />
      </section>
    </>
  );
}
