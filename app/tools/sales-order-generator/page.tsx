import type { Metadata } from "next";
import { DocumentTool } from "@/components/tools/docgen/DocumentTool";

export const metadata: Metadata = {
  title: "Free Sales Order Generator | SO Confirmation PDF | Setu Technology",
  description: "Confirm customer orders before dispatch with a professional sales order — items, prices, delivery date, PDF. Free, no signup.",
  keywords: ["sales order generator", "sales order format", "order confirmation document", "SO maker", "free sales order template"],
  alternates: { canonical: "/tools/sales-order-generator" },
  openGraph: {
    title: "Sales Order Generator",
    description: "Confirm customer orders before dispatch with a professional sales order — items, prices, delivery date, PDF. Free, no signup.",
    url: "/tools/sales-order-generator",
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
      name: "What is a sales order for?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It confirms a customer's order in writing before you dispatch or invoice — locking in items, quantities, prices and the delivery date so both sides agree upfront.",
      },
    },
    {
      "@type": "Question",
      name: "How is a sales order different from an invoice?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The sales order confirms the order; the invoice demands payment. Typically you issue the SO on confirmation, then convert it to an invoice at dispatch (our free Invoice Generator handles that part).",
      },
    },
    {
      "@type": "Question",
      name: "Is my data private?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — everything stays in your browser's local storage, nothing is uploaded, and no signup is needed.",
      },
    }
  ],
};

export default function SalesOrderGeneratorPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Sales Order Generator</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            Confirm what the customer ordered — items, prices and delivery date — before anything ships.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <DocumentTool docType="sales-order" />
      </section>
    </>
  );
}
