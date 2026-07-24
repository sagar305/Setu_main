import type { Metadata } from "next";
import { DocumentTool } from "@/components/tools/docgen/DocumentTool";

export const metadata: Metadata = {
  title: "Free Debit Note Generator | Purchase Returns PDF | Setu Technology",
  description: "Create debit notes for purchase returns, short supply and rate differences. GST fields, itemised lines, instant PDF. Free, no signup.",
  keywords: ["debit note generator", "debit note format", "purchase return note", "GST debit note", "free debit note maker"],
  alternates: { canonical: "/tools/debit-note-generator" },
  openGraph: {
    title: "Debit Note Generator",
    description: "Create debit notes for purchase returns, short supply and rate differences. GST fields, itemised lines, instant PDF. Free, no signup.",
    url: "/tools/debit-note-generator",
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
      name: "What is a debit note used for?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A buyer issues a debit note to a supplier to record a reduction in what they owe — returned goods, short supply, damaged items or a rate difference against the supplier's bill.",
      },
    },
    {
      "@type": "Question",
      name: "What's the difference between a debit note and a credit note?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "They're two sides of the same adjustment: the buyer raises a debit note on the supplier; the seller responds with (or directly issues) a credit note. Which one you issue depends on which side of the transaction you're on.",
      },
    },
    {
      "@type": "Question",
      name: "Is my data private?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — documents are saved only in your browser's local storage. Nothing is uploaded, and no account is needed.",
      },
    }
  ],
};

export default function DebitNoteGeneratorPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Debit Note Generator</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            Returning goods or disputing a supplier bill? Issue a clean, itemised debit note in a minute.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <DocumentTool docType="debit-note" />
      </section>
    </>
  );
}
