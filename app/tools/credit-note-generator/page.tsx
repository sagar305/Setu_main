import type { Metadata } from "next";
import { DocumentTool } from "@/components/tools/docgen/DocumentTool";

export const metadata: Metadata = {
  title: "Free Credit Note Generator | GST-Ready PDF | Setu Technology",
  description: "Create professional credit notes for returns and adjustments. GST fields, itemised lines, instant PDF. Free, offline, no signup.",
  keywords: ["credit note generator", "credit note format", "GST credit note", "credit note against invoice", "free credit note maker"],
  alternates: { canonical: "/tools/credit-note-generator" },
  openGraph: {
    title: "Credit Note Generator",
    description: "Create professional credit notes for returns and adjustments. GST fields, itemised lines, instant PDF. Free, offline, no signup.",
    url: "/tools/credit-note-generator",
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
      name: "When should I issue a credit note?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "When you need to reduce the value of an invoice you already issued — goods returned, an overcharge, a post-sale discount, or a billing error. The credit note references the original invoice and records the reduction.",
      },
    },
    {
      "@type": "Question",
      name: "Is this credit note GST-compliant?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It carries the fields GST practice expects — your GSTIN, the customer's GSTIN, the original invoice reference, itemised lines with tax rates and a clear reason. Report it in your GST returns as your CA advises.",
      },
    },
    {
      "@type": "Question",
      name: "Is my data private?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — everything stays in your browser's local storage. Nothing is uploaded to any server, and there's no signup.",
      },
    }
  ],
};

export default function CreditNoteGeneratorPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Credit Note Generator</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            Handle returns and billing adjustments professionally — reference the invoice, list the items, print the PDF.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <DocumentTool docType="credit-note" />
      </section>
    </>
  );
}
