import type { Metadata } from "next";
import { AbcAnalysisTool } from "@/components/tools/analysis/AbcAnalysisTool";

export const metadata: Metadata = {
  title: "Free ABC Analysis Calculator | Inventory Classification | Setu Technology",
  description: "Classify inventory into A, B and C classes by annual consumption value — the 80/15/5 rule, computed automatically. CSV export. Free, no signup.",
  keywords: ["ABC analysis", "inventory classification", "ABC inventory method", "pareto inventory analysis", "stock control ABC"],
  alternates: { canonical: "/tools/abc-analysis" },
  openGraph: {
    title: "ABC Analysis",
    description: "Classify inventory into A, B and C classes by annual consumption value — the 80/15/5 rule, computed automatically. CSV export. Free, no signup.",
    url: "/tools/abc-analysis",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology - Setu for your business",
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
      name: "What is ABC analysis?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An inventory method based on the Pareto principle: class A items are the vital few (~80% of consumption value), B the middle (~15%), C the trivial many (~5%). Each class gets a matching level of control.",
      },
    },
    {
      "@type": "Question",
      name: "How are items classified?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Rank items by annual consumption value (annual quantity × unit cost), take the cumulative percentage of total value, and cut at 80% (A), 95% (B) and beyond (C) — exactly what this tool automates.",
      },
    },
    {
      "@type": "Question",
      name: "How should I treat each class?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A: tight control — frequent counts, careful reorder points, negotiated pricing. B: moderate, periodic review. C: simple rules and bulk orders. Pair with our Stock Reorder Point calculator for the A items.",
      },
    }
  ],
};

export default function AbcAnalysisPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">ABC Analysis</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            Not all stock deserves equal attention — rank items by annual value and manage class A tightly.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <AbcAnalysisTool />
      </section>
    </>
  );
}
