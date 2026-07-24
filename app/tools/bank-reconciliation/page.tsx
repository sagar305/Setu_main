import type { Metadata } from "next";
import { BankReconciliationTool } from "@/components/tools/bookkeeping/BankReconciliationTool";

export const metadata: Metadata = {
  title: "Free Bank Reconciliation Tool | Match Bank & Book Balance | Setu Technology",
  description: "Reconcile your bank statement with your cash book — track uncleared cheques, deposits in transit and bank charges until the balances match. Free, no signup.",
  keywords: ["bank reconciliation", "bank reconciliation statement", "BRS format", "reconcile bank statement", "bank book difference"],
  alternates: { canonical: "/tools/bank-reconciliation" },
  openGraph: {
    title: "Bank Reconciliation",
    description: "Reconcile your bank statement with your cash book — track uncleared cheques, deposits in transit and bank charges until the balances match. Free, no signup.",
    url: "/tools/bank-reconciliation",
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
      name: "Why don't my bank and book balances match?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Timing and omissions: cheques you issued that haven't cleared, deposits the bank hasn't credited yet, bank charges and interest you haven't recorded. Each is a reconciling item.",
      },
    },
    {
      "@type": "Question",
      name: "How often should I reconcile?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Monthly at minimum, when the bank statement arrives. Busy businesses reconcile weekly — the sooner you catch an error or a missing entry, the easier it is to fix.",
      },
    },
    {
      "@type": "Question",
      name: "What if a difference remains after adjusting?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Check for transposed digits (a difference divisible by 9 is a classic sign), duplicated entries, or a transaction recorded on the wrong side. The tool shows the residual difference live as you add items.",
      },
    }
  ],
};

export default function BankReconciliationPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Bank Reconciliation</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            Bank says one number, your books say another — list the reconciling items until they agree.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <BankReconciliationTool />
      </section>
    </>
  );
}
