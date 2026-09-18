import type { Metadata } from "next";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { CustomerStatementTool } from "@/components/tools/statements/CustomerStatementTool";
import { GlossaryTermsStrip } from "@/components/glossary/GlossaryTermsStrip";

export const metadata: Metadata = toolMetadata("customer-statement");

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is a statement of account?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A summary of all transactions with one customer over a period — invoices raised, payments received, credit notes issued — ending in the balance they currently owe.",
      },
    },
    {
      "@type": "Question",
      name: "When should I send customer statements?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Monthly for regular credit customers, and immediately when chasing overdue payment. A clear statement resolves most \"we already paid that\" conversations.",
      },
    },
    {
      "@type": "Question",
      name: "How is the balance calculated?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Opening balance plus invoices, minus payments and credit notes, in date order. The tool recalculates the running balance automatically as you add transactions.",
      },
    }
  ],
};

export default function CustomerStatementPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Customer Statement</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            Every invoice, payment and adjustment for one customer — with the running balance that settles arguments.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <CustomerStatementTool />
      </section>
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <GlossaryTermsStrip type="tool" slug="customer-statement" />
      </section>
    </>
  );
}
