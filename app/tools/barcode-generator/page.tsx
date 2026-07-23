import type { Metadata } from "next";
import { BarcodeGeneratorTool } from "@/components/tools/BarcodeGenerator/BarcodeGeneratorTool";
import { SuggestedTools } from "@/components/toolkit/SuggestedTools";

export const metadata: Metadata = {
  title: "Free Barcode Generator | EAN-13, Code 128 & QR | Setu Technology",
  description:
    "Generate EAN-13, Code 128 and QR barcodes for free. Use your saved products, download as PNG or PDF. Works offline, no signup required.",
  keywords: [
    "barcode generator",
    "free barcode generator",
    "EAN-13 generator",
    "Code 128 generator",
    "product barcode",
    "barcode maker online",
  ],
  alternates: { canonical: "/tools/barcode-generator" },
  openGraph: {
    title: "Free Barcode Generator — EAN-13, Code 128 & QR",
    description:
      "Generate product barcodes in your browser and download as PNG or PDF. No signup.",
    url: "/tools/barcode-generator",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology Barcode Generator",
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
    </>
  );
}
