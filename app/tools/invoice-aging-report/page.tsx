import type { Metadata } from "next";
import { AgingReportTool } from "@/components/tools/aging/AgingReportTool";

export const metadata: Metadata = {
  title: "Free Invoice Aging Report | Accounts Receivable Buckets | Setu Technology",
  description: "Track unpaid customer invoices in aging buckets — current, 1–30, 31–60, 61–90 and 90+ days overdue, by customer. CSV export. Free, no signup.",
  keywords: ["invoice aging report", "accounts receivable aging", "AR aging", "overdue invoices report", "debtor aging analysis"],
  alternates: { canonical: "/tools/invoice-aging-report" },
  openGraph: {
    title: "Invoice Aging Report",
    description: "Track unpaid customer invoices in aging buckets — current, 1–30, 31–60, 61–90 and 90+ days overdue, by customer. CSV export. Free, no signup.",
    url: "/tools/invoice-aging-report",
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
      name: "What is an invoice aging report?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A view of all unpaid customer invoices grouped by how overdue they are — not yet due, 1–30, 31–60, 61–90 and 90+ days. It's the standard tool for prioritising collections.",
      },
    },
    {
      "@type": "Question",
      name: "Which bucket should I chase first?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The oldest. Collection odds fall sharply with age — industry studies put the expected recovery of a debt past 90 days well below face value. The 90+ column is your priority list.",
      },
    },
    {
      "@type": "Question",
      name: "How do overdue invoices affect my business?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Money in the 30+ buckets is working capital you're lending interest-free while possibly paying for your own credit. Check the Payment Terms calculator to price early-payment discounts that pull cash in faster.",
      },
    }
  ],
};

export default function InvoiceAgingReportPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Invoice Aging Report</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            Who owes you, how much, and how overdue — bucketed by age so you chase the right money first.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <AgingReportTool kind="receivable" />
      </section>
    </>
  );
}
