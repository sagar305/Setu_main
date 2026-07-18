import type { Metadata } from "next";
import { SupplierBookTool } from "@/components/tools/SupplierBook/SupplierBookTool";
import { SuggestedTools } from "@/components/toolkit/SuggestedTools";

export const metadata: Metadata = {
  title: "Free Supplier Book | Vendor Contacts & GSTIN | Setu Technology",
  description:
    "Keep all your supplier and vendor details in one place — contacts, GSTIN, addresses and notes. Free, offline, no signup, reusable across Setu tools.",
  keywords: [
    "supplier book",
    "vendor management free",
    "supplier contacts",
    "supplier GSTIN record",
    "vendor register",
  ],
  alternates: { canonical: "/tools/supplier-book" },
  openGraph: {
    title: "Free Supplier Book — Vendor Contacts & GSTIN",
    description:
      "Save supplier details once, reuse them in the Purchase Register and every Setu tool.",
    url: "/tools/supplier-book",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology Supplier Book",
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
      name: "Where is my supplier data stored?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "In your browser on your device, inside your Setu business workspace. Nothing is uploaded — no signup, no cloud.",
      },
    },
    {
      "@type": "Question",
      name: "Which other tools use my suppliers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The Purchase Register picks suppliers straight from this book, so you never retype vendor details when recording a purchase bill.",
      },
    },
    {
      "@type": "Question",
      name: "Can I export my suppliers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — export the whole book as a CSV that opens in Excel or Google Sheets, any time.",
      },
    },
  ],
};

export default function SupplierBookPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Supplier Book</h1>
          <p className="mt-4 text-xl text-muted">
            All your vendors in one place — saved once, reused by every Setu tool.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <SupplierBookTool />
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <SuggestedTools current="supplier-book" />
      </section>
    </>
  );
}
