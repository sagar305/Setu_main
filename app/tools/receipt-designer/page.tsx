import type { Metadata } from "next";
import { ReceiptDesignerTool } from "@/components/tools/ReceiptDesigner/ReceiptDesignerTool";
import { SuggestedTools } from "@/components/toolkit/SuggestedTools";

export const metadata: Metadata = {
  title: "Free Receipt Designer | Thermal Receipt Templates | Setu Technology",
  description:
    "Design your shop's receipt — logo, colors, header, footer — and reuse it in the Setu Browser POS. 80mm/58mm thermal and A4. Free, offline, no signup.",
  keywords: [
    "receipt designer",
    "thermal receipt template",
    "80mm receipt design",
    "custom receipt maker",
    "POS receipt template",
  ],
  alternates: { canonical: "/tools/receipt-designer" },
  openGraph: {
    title: "Free Receipt Designer — Design Once, Print Everywhere",
    description:
      "Design a branded receipt template and reuse it across Setu tools. Offline, no signup.",
    url: "/tools/receipt-designer",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology Receipt Designer",
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
            Receipt Designer
          </h1>
          <p className="mt-4 text-xl text-muted">
            Design your receipt once — the POS prints with it. No redesign, no copy.
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
