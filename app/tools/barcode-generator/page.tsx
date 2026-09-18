import type { Metadata } from "next";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { BarcodeGeneratorTool } from "@/components/tools/BarcodeGenerator/BarcodeGeneratorTool";
import { SuggestedTools } from "@/components/toolkit/SuggestedTools";
import { ToolSchema } from "@/components/toolkit/ToolSchema";
import { GlossaryTermsStrip } from "@/components/glossary/GlossaryTermsStrip";

export const metadata: Metadata = toolMetadata("barcode-generator");

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Which barcode types can I generate?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can generate EAN-13 (the standard retail barcode), Code 128 (flexible, encodes any text — great for SKUs), and QR codes (for links, text or UPI).",
      },
    },
    {
      "@type": "Question",
      name: "Is this barcode generator free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — completely free with no signup. Barcodes are generated on your device and never sent to a server.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use my saved products?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. If you use other Setu tools like the Browser POS on this device, you can connect your business workspace and generate barcodes for saved products in one click.",
      },
    },
    {
      "@type": "Question",
      name: "What formats can I download?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PNG for digital use and PDF for printing. Both are generated locally in your browser.",
      },
    },
  ],
};

export default function BarcodeGeneratorPage() {
  return (
    <>
      <ToolSchema slug="barcode-generator" />
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
            Barcode Generator
          </h1>
          <p className="mt-4 text-xl text-muted">
            Generate EAN-13, Code 128 and QR barcodes — download as PNG or PDF. Works offline.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <BarcodeGeneratorTool />
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="space-y-8">
          <div>
            <h2 className="mb-4 text-2xl font-bold text-ink">How does it work?</h2>
            <ol className="space-y-3 text-muted">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo text-sm font-semibold text-white">1</span>
                <span>Choose the barcode type — Code 128 for SKUs, EAN-13 for retail, QR for links</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo text-sm font-semibold text-white">2</span>
                <span>Type the value, or pick a saved product from your workspace</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo text-sm font-semibold text-white">3</span>
                <span>Download as PNG or PDF and print or share it</span>
              </li>
            </ol>
          </div>
          <SuggestedTools current="barcode-generator" />
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <GlossaryTermsStrip type="tool" slug="barcode-generator" />
      </section>
    </>
  );
}
