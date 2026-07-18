import type { Metadata } from "next";
import { CustomerLedgerTool } from "@/components/tools/CustomerLedger/CustomerLedgerTool";
import { SuggestedTools } from "@/components/toolkit/SuggestedTools";

export const metadata: Metadata = {
  title: "Free Customer Ledger (Udhaar Khata) | Credit & Payments | Setu Technology",
  description:
    "Digital udhaar khata — track credit given and payments received per customer, with running balances. Free, offline, no signup.",
  keywords: [
    "udhaar khata",
    "customer ledger",
    "credit book",
    "khata book free",
    "customer credit tracker",
    "udhar bahi khata",
  ],
  alternates: { canonical: "/tools/customer-ledger" },
  openGraph: {
    title: "Free Customer Ledger — Digital Udhaar Khata",
    description:
      "Track credit and payments per customer with automatic balances. Offline, no signup.",
    url: "/tools/customer-ledger",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology Customer Ledger",
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
      name: "What is a digital udhaar khata?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A digital version of the traditional credit notebook: record credit you give a customer and payments they make, and the running balance is calculated automatically per customer.",
      },
    },
    {
      "@type": "Question",
      name: "Does it use my existing customers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. If you use the Setu Browser POS or Invoice Generator on this device, the ledger uses the same shared customer book — add a customer once, use them everywhere.",
      },
    },
    {
      "@type": "Question",
      name: "Is my khata private?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Completely. All data stays in your browser on your device — no signup, no cloud. Export a CSV backup any time.",
      },
    },
  ],
};

export default function CustomerLedgerPage() {
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
            Customer Ledger
          </h1>
          <p className="mt-4 text-xl text-muted">
            Your udhaar khata, digital — credit, payments and balances per customer.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <CustomerLedgerTool />
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <SuggestedTools current="customer-ledger" />
      </section>
    </>
  );
}
