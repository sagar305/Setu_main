import type { Metadata } from "next";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { StockRegisterTool } from "@/components/tools/StockRegister/StockRegisterTool";
import { SuggestedTools } from "@/components/toolkit/SuggestedTools";
import { ToolSchema } from "@/components/toolkit/ToolSchema";
import { GlossaryTermsStrip } from "@/components/glossary/GlossaryTermsStrip";

export const metadata: Metadata = toolMetadata("stock-register");

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
      <ToolSchema slug="stock-register" />
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
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <GlossaryTermsStrip type="tool" slug="stock-register" />
      </section>
    </>
  );
}
