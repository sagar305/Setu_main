import type { Metadata } from "next";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { DocumentTool } from "@/components/tools/docgen/DocumentTool";
import { GlossaryTermsStrip } from "@/components/glossary/GlossaryTermsStrip";

export const metadata: Metadata = toolMetadata("credit-note-generator");

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
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <GlossaryTermsStrip type="tool" slug="credit-note-generator" />
      </section>
    </>
  );
}
