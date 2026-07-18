import type { Metadata } from "next";
import { QuotationGeneratorTool } from "@/components/tools/QuotationGenerator/QuotationGeneratorTool";
import { SuggestedTools } from "@/components/toolkit/SuggestedTools";

export const metadata: Metadata = {
  title: "Free Quotation Generator | Estimates & Quotes | Setu Technology",
  description:
    "Create professional quotations and estimates with validity dates, tax and totals. Print or save as PDF. Free, offline, no signup.",
  keywords: [
    "quotation generator",
    "free quotation maker",
    "estimate generator",
    "quote template",
    "quotation format",
    "proforma quote",
  ],
  alternates: { canonical: "/tools/quotation-generator" },
  openGraph: {
    title: "Free Quotation Generator",
    description:
      "Create professional quotes with validity dates and totals — print or save as PDF. No signup.",
    url: "/tools/quotation-generator",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology Quotation Generator",
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
      name: "What is the difference between a quotation and an invoice?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A quotation is a price offer sent before the work or sale — it has a validity date and is not a tax document. An invoice is the bill raised after. Setu has a separate free Invoice Generator for that.",
      },
    },
    {
      "@type": "Question",
      name: "Can I track whether a quote was accepted?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — saved quotations carry a status: draft, sent, accepted or declined. Update it as the deal moves.",
      },
    },
    {
      "@type": "Question",
      name: "Does it reuse my business and customer details?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Connect your Setu workspace and your business details, saved customers and products fill in automatically — nothing to retype.",
      },
    },
    {
      "@type": "Question",
      name: "How do I get a PDF?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Click Print / PDF and choose 'Save as PDF' in your browser's print dialog. Everything happens on your device.",
      },
    },
  ],
};

export default function QuotationGeneratorPage() {
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
            Quotation Generator
          </h1>
          <p className="mt-4 text-xl text-muted">
            Professional quotes with validity dates and status tracking — print or save as PDF.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <QuotationGeneratorTool />
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <SuggestedTools current="quotation-generator" />
      </section>
    </>
  );
}
