import type { Metadata } from "next";
import { ReceiptDesignerTool } from "@/components/tools/ReceiptDesigner/ReceiptDesignerTool";
import { SuggestedTools } from "@/components/toolkit/SuggestedTools";

export const metadata: Metadata = {
  title: "Free Receipt Generator | Make & Print Receipts | Setu Technology",
  description:
    "Design your shop's receipt — logo, colors, header, footer — then fill in a sale and print a real receipt. Reuse the same design in the Setu Browser POS. 80mm/58mm thermal and A4. Free, offline, no signup.",
  keywords: [
    "receipt generator",
    "receipt maker",
    "thermal receipt template",
    "80mm receipt design",
    "print receipt online",
    "POS receipt template",
  ],
  alternates: { canonical: "/tools/receipt-designer" },
  openGraph: {
    title: "Free Receipt Generator — Design, Fill & Print",
    description:
      "Design a branded receipt, fill in a sale and print it — and reuse the design across Setu tools. Offline, no signup.",
    url: "/tools/receipt-designer",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology Receipt Generator",
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
      name: "Where can I use my saved receipt template?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Templates are saved to your Setu workspace on this device. The Browser POS can print bills using them — design here once, no redesign, no copying.",
      },
    },
    {
      "@type": "Question",
      name: "Which paper sizes are supported?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Thermal 80mm and 58mm (the common billing-roll sizes) and A4.",
      },
    },
    {
      "@type": "Question",
      name: "Does the preview show my real business details?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — connect your workspace and the live preview uses your actual business name, logo, address and GSTIN.",
      },
    },
  ],
};

export default function ReceiptDesignerPage() {
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
            Receipt Generator
          </h1>
          <p className="mt-4 text-xl text-muted">
            Design your receipt, fill in a sale and print it — and the same design prints from the POS too.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <ReceiptDesignerTool />
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <SuggestedTools current="receipt-designer" />
      </section>
    </>
  );
}
