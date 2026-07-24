import type { Metadata } from "next";
import { DocumentTool } from "@/components/tools/docgen/DocumentTool";

export const metadata: Metadata = {
  title: "Free Purchase Order Generator | PO PDF Maker | Setu Technology",
  description: "Create professional purchase orders with delivery dates, itemised lines and taxes. Print to PDF instantly. Free, offline, no signup.",
  keywords: ["purchase order generator", "PO maker", "purchase order format", "free purchase order template", "PO PDF"],
  alternates: { canonical: "/tools/purchase-order-generator" },
  openGraph: {
    title: "Purchase Order Generator",
    description: "Create professional purchase orders with delivery dates, itemised lines and taxes. Print to PDF instantly. Free, offline, no signup.",
    url: "/tools/purchase-order-generator",
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
      name: "Why use a purchase order instead of a phone call?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A PO puts the items, quantities, rates and delivery date in writing before money moves. It prevents \"that's not what I ordered\" disputes and gives you a paper trail to check the supplier's bill against.",
      },
    },
    {
      "@type": "Question",
      name: "What should a purchase order include?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PO number and date, supplier details, itemised lines with quantities and agreed rates, taxes, expected delivery date, and any terms — all of which this tool covers.",
      },
    },
    {
      "@type": "Question",
      name: "Can I save purchase orders for later?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — saved POs stay in your browser's local storage so you can reprint them any time. Nothing is uploaded to a server.",
      },
    }
  ],
};

export default function PurchaseOrderGeneratorPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Purchase Order Generator</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            Authorize supplier purchases formally — items, rates, delivery date and terms on one clean PO.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <DocumentTool docType="purchase-order" />
      </section>
    </>
  );
}
