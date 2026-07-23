import type { Metadata } from "next";
import { StockRegisterTool } from "@/components/tools/StockRegister/StockRegisterTool";
import { SuggestedTools } from "@/components/toolkit/SuggestedTools";

export const metadata: Metadata = {
  title: "Free Stock Register | Live Inventory & Adjustments | Setu Technology",
  description:
    "See live stock levels, record stock in/out and review every movement — shared with your Setu Browser POS. Free, offline, no signup.",
  keywords: [
    "stock register",
    "inventory register",
    "stock management free",
    "stock in out register",
    "inventory tracker offline",
  ],
  alternates: { canonical: "/tools/stock-register" },
  openGraph: {
    title: "Free Stock Register — Live Inventory & Adjustments",
    description:
      "Live stock levels, adjustments and full movement history — shared with the Setu Browser POS.",
    url: "/tools/stock-register",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology Stock Register",
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
      name: "Where does the stock data come from?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "From your Setu business workspace on this device — the same products and stock the Browser POS uses. There is one source of truth: an adjustment here is instantly visible in the POS, and every POS sale shows up in the movement history here.",
      },
    },
    {
      "@type": "Question",
      name: "Is my inventory data uploaded anywhere?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Everything stays in your browser on your device. No signup, no cloud, no server.",
      },
    },
    {
      "@type": "Question",
      name: "Can I export the register?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — download the current stock list as a CSV file that opens in Excel or Google Sheets.",
      },
    },
  ],
};

export default function StockRegisterPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Stock Register</h1>
          <p className="mt-4 text-xl text-muted">
            Live stock levels, quick adjustments and a full movement history — one source of truth
            with your POS.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <StockRegisterTool />
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <SuggestedTools current="stock-register" />
      </section>
    </>
  );
}
