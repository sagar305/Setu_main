import type { Metadata } from "next";
import { PurchaseRegisterTool } from "@/components/tools/PurchaseRegister/PurchaseRegisterTool";
import { SuggestedTools } from "@/components/toolkit/SuggestedTools";

export const metadata: Metadata = {
  title: "Free Purchase Register | Record Supplier Bills | Setu Technology",
  description:
    "Record purchase bills against suppliers, link items to your products and update stock automatically. Free, offline, no signup.",
  keywords: [
    "purchase register",
    "purchase bill record",
    "supplier purchases",
    "purchase entry free",
    "stock purchase register",
  ],
  alternates: { canonical: "/tools/purchase-register" },
  openGraph: {
    title: "Free Purchase Register — Supplier Bills & Stock",
    description:
      "Record purchases, reuse suppliers from your Supplier Book, and update product stock with one confirmation.",
    url: "/tools/purchase-register",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology Purchase Register",
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
      name: "Can purchases update my product stock?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Link purchase lines to your saved products and, after one confirmation, the purchased quantities are added to stock — visible instantly in the Stock Register and the Browser POS.",
      },
    },
    {
      "@type": "Question",
      name: "Do I have to retype supplier details?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Suppliers saved in the Supplier Book appear in a dropdown here. Save a vendor once, reuse forever.",
      },
    },
    {
      "@type": "Question",
      name: "Is my purchase data private?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Completely. Everything is stored in your browser on your device — no signup, no cloud, and you can export a CSV any time.",
      },
    },
  ],
};

export default function PurchaseRegisterPage() {
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
            Purchase Register
          </h1>
          <p className="mt-4 text-xl text-muted">
            Record supplier bills, link products, and update stock with one confirmation.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <PurchaseRegisterTool />
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <SuggestedTools current="purchase-register" />
      </section>
    </>
  );
}
