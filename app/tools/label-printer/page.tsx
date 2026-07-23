import type { Metadata } from "next";
import { LabelPrinterTool } from "@/components/tools/LabelPrinter/LabelPrinterTool";
import { SuggestedTools } from "@/components/toolkit/SuggestedTools";

export const metadata: Metadata = {
  title: "Free Price Label Printer | Barcode Labels on A4 & Thermal | Setu Technology",
  description:
    "Print price and barcode labels for your products — A4 label sheets (65/40/24 per sheet) or thermal rolls. Free, offline, no signup.",
  keywords: [
    "label printer",
    "price label generator",
    "barcode label printing",
    "product labels A4",
    "thermal label 50x25",
    "shelf label generator",
  ],
  alternates: { canonical: "/tools/label-printer" },
  openGraph: {
    title: "Free Price & Barcode Label Printer",
    description:
      "Print product labels on A4 label sheets or thermal rolls, right from your browser.",
    url: "/tools/label-printer",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology Label Printer",
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
      name: "Which label sizes are supported?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A4 label sheets with 65, 40 or 24 labels per sheet, and thermal roll labels in 50×25mm and 38×25mm. Choose the format and the layout adjusts automatically.",
      },
    },
    {
      "@type": "Question",
      name: "What can I put on each label?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Product name, price, a Code 128 barcode, and the SKU text — each can be turned on or off.",
      },
    },
    {
      "@type": "Question",
      name: "Can I print labels for my saved products?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. If you use the Setu Browser POS or other Setu tools on this device, connect your workspace and add products to the label list in one click — names, prices and barcodes are filled automatically.",
      },
    },
    {
      "@type": "Question",
      name: "Does it need special software?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Printing uses your browser's normal print dialog, so any printer that works with your computer works here — including thermal label printers.",
      },
    },
  ],
};

export default function LabelPrinterPage() {
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
            Price Label Printer
          </h1>
          <p className="mt-4 text-xl text-muted">
            Print price and barcode labels on A4 sheets or thermal rolls — straight from your browser.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <LabelPrinterTool />
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <SuggestedTools current="label-printer" />
      </section>
    </>
  );
}
