import type { Metadata } from "next";
import { AgingReportTool } from "@/components/tools/aging/AgingReportTool";

export const metadata: Metadata = {
  title: "Free Accounts Payable Aging Report | Supplier Bills by Age | Setu Technology",
  description: "Track unpaid supplier bills in aging buckets — see what's due now, what's overdue and which supplier to pay first. CSV export. Free, no signup.",
  keywords: ["accounts payable aging", "AP aging report", "supplier bills tracker", "creditor aging", "payables report"],
  alternates: { canonical: "/tools/accounts-payable-aging" },
  openGraph: {
    title: "Accounts Payable Aging",
    description: "Track unpaid supplier bills in aging buckets — see what's due now, what's overdue and which supplier to pay first. CSV export. Free, no signup.",
    url: "/tools/accounts-payable-aging",
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
      name: "What is an AP aging report?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A view of all unpaid supplier bills grouped by how overdue they are. It shows total exposure per supplier and flags payments at risk of souring a relationship.",
      },
    },
    {
      "@type": "Question",
      name: "How should I use it to schedule payments?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Clear the oldest bills first to protect supplier goodwill and credit terms, and time the rest against your cash position. Bills not yet due can often wait until close to the due date.",
      },
    },
    {
      "@type": "Question",
      name: "Should I pay early if a supplier offers a discount?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Often yes — the Payment Terms calculator on this site shows the annualized return of taking an early-payment discount, which frequently beats keeping the cash in the bank.",
      },
    }
  ],
};

export default function AccountsPayableAgingPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Accounts Payable Aging</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            Every unpaid supplier bill, bucketed by age — so you pay the right people at the right time.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <AgingReportTool kind="payable" />
      </section>
    </>
  );
}
