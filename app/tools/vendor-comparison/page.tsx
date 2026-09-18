import type { Metadata } from "next";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { VendorComparisonTool } from "@/components/tools/analysis/VendorComparisonTool";
import { GlossaryTermsStrip } from "@/components/glossary/GlossaryTermsStrip";

export const metadata: Metadata = toolMetadata("vendor-comparison");

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does the scoring work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Each criterion is normalised across vendors (best gets full marks), multiplied by the weight you set, and summed to a score out of 100. Change the weights and the ranking updates instantly.",
      },
    },
    {
      "@type": "Question",
      name: "What weights should I use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Match them to what hurts most when it goes wrong. Perishable goods? Weight delivery high. Tight cash? Weight credit terms. Customer-facing quality? Weight quality. The defaults (40/20/15/25) suit most retail buying.",
      },
    },
    {
      "@type": "Question",
      name: "Why not just pick the cheapest quote?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The cheapest vendor who delivers late or supplies poor quality costs more in stockouts, returns and lost customers. A weighted score makes those trade-offs explicit instead of gut-feel.",
      },
    }
  ],
};

export default function VendorComparisonPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Vendor Comparison</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            Price isn&apos;t everything — weigh delivery, credit and quality too, and let the score pick the vendor.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <VendorComparisonTool />
      </section>
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <GlossaryTermsStrip type="tool" slug="vendor-comparison" />
      </section>
    </>
  );
}
