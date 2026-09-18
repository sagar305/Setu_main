import type { Metadata } from "next";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { BusinessProfileTool } from "@/components/tools/BusinessProfile/BusinessProfileTool";
import { SuggestedTools } from "@/components/toolkit/SuggestedTools";
import { ToolSchema } from "@/components/toolkit/ToolSchema";
import { GlossaryTermsStrip } from "@/components/glossary/GlossaryTermsStrip";

export const metadata: Metadata = toolMetadata("business-profile");

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Why set up a business profile?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "So you never type your details twice. Your name, GSTIN, logo and address are saved once on this device, and every Setu tool — POS, invoices, receipts, labels — fills them in automatically.",
      },
    },
    {
      "@type": "Question",
      name: "Where is the profile stored?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "In your browser on your device, in your private Setu workspace. No signup, no cloud, and you can export or delete it any time.",
      },
    },
  ],
};

export default function BusinessProfilePage() {
  return (
    <>
      <ToolSchema slug="business-profile" />
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
            Business Profile
          </h1>
          <p className="mt-4 text-xl text-muted">
            Set up once. Every Setu tool on this device reuses it — nothing asks twice.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <BusinessProfileTool />
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <SuggestedTools current="business-profile" />
      </section>
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <GlossaryTermsStrip type="tool" slug="business-profile" />
      </section>
    </>
  );
}
