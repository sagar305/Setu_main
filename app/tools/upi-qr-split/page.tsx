import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { UpiQrSplitTool } from "@/components/tools/UpiQrSplit/UpiQrSplitTool";
import { ToolSchema } from "@/components/toolkit/ToolSchema";
import { GlossaryTermsStrip } from "@/components/glossary/GlossaryTermsStrip";

export const metadata: Metadata = {
  title: "Zero-MDR UPI QR Splitter — Split a Payment | Setu",
  description:
    "Split a large payment into several sub-₹2,000 UPI QR codes so no interchange or MDR applies. Free, no signup, and every QR is generated on your own device.",
  keywords: [
    "zero MDR UPI",
    "UPI QR splitter",
    "split payment QR code",
    "avoid MDR charges",
    "UPI 2000 limit interchange",
    "MDR free payment collection",
  ],
  alternates: {
    canonical: "/tools/upi-qr-split",
  },
  openGraph: {
    title: "Zero-MDR UPI QR Splitter",
    description:
      "Break a large payment into several sub-₹2,000 UPI QR codes and collect the full amount without paying MDR.",
    url: "/tools/upi-qr-split",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology zero-MDR UPI QR splitter",
      },
    ],
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      question: "How does splitting a payment avoid MDR?",
      answer:
        "On UPI, interchange on wallet (PPI) and credit-card-on-UPI transactions applies only above ₹2,000 per transaction. A ₹7,500 collection taken as one payment crosses that line, but taken as four QR codes of ₹2,000 or less, each transaction sits under the threshold and no interchange applies.",
    },
    {
      question: "Why is the default ₹1,999 and not ₹2,000?",
      answer:
        "₹2,000 is the boundary itself. Setting the ceiling one rupee below it keeps every transaction clearly under the threshold rather than exactly on it, which avoids any argument about how a particular acquirer rounds or interprets the limit. You can change the figure if you prefer.",
    },
    {
      question: "Is my UPI ID sent to Setu's servers?",
      answer:
        "No. Every QR code is generated in your browser, and your UPI ID is saved only in your own device's local storage so it is there next time. Nothing about the payment reaches our servers.",
    },
    {
      question: "Do UPI payments from a bank account have MDR anyway?",
      answer:
        "No — UPI funded from a bank account carries zero MDR for merchants regardless of amount, as does RuPay debit. The threshold matters for wallet (PPI) and credit-card-on-UPI payments, where interchange of around 1.1% applies above ₹2,000.",
    },
    {
      question: "Is it allowed to split a payment this way?",
      answer:
        "Collecting several separate payments from a customer is ordinary commercial practice, and nothing here bypasses a payment system's controls. That said, acquirer agreements differ, and some prohibit deliberately structuring transactions to avoid fees. Check your own merchant agreement before making this a routine practice.",
    },
  ].map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export default function UpiQrSplitPage() {
  return (
    <>
      <ToolSchema slug="upi-qr-split" />
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
            Zero-MDR UPI QR Splitter
          </h1>
          <p className="mt-4 text-xl text-muted">
            Break a large payment into several sub-₹2,000 QR codes and collect the whole amount
            without losing a cut to MDR.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-dashed border-muted-line/40 bg-cream p-10 text-center text-muted">
              Loading…
            </div>
          }
        >
          <UpiQrSplitTool />
        </Suspense>
      </section>

      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-4 text-2xl font-bold text-ink">Why this works</h2>
          <p className="mb-4 text-muted">
            UPI payments funded straight from a bank account carry zero MDR for merchants, and so do
            RuPay debit cards. The cost shows up on two other rails: wallet (PPI) payments and credit
            cards routed over UPI, where interchange of roughly 1.1% applies — but{" "}
            <strong className="text-ink">only on transactions above ₹2,000</strong>.
          </p>
          <p className="mb-4 text-muted">
            That threshold is per transaction, not per customer or per day. A ₹7,500 bill collected in
            one go sits above it and attracts interchange plus 18% GST on that interchange. The same
            ₹7,500 collected as four QR codes of ₹1,999, ₹1,999, ₹1,999 and ₹1,503 stays under the
            line on every leg, and the full amount settles to you.
          </p>
          <p className="text-muted">
            Work out what you are paying today with the{" "}
            <Link href="/calculators/mdr-calculator" className="font-semibold text-indigo hover:underline">
              MDR Calculator
            </Link>
            , then bring the amount here to see the split.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="space-y-8">
          <div>
            <h2 className="mb-4 text-2xl font-bold text-ink">How to use it</h2>
            <ol className="space-y-3 text-muted">
              {[
                "Enter the total amount you need to collect",
                "Leave the ceiling at ₹1,999, or set your own",
                "Add your UPI ID and business name",
                "Show each QR code to the customer in turn, or share the UPI links",
                "Use the reference note to reconcile the parts against one bill",
              ].map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-muted-line/30 bg-cream p-6">
            <h2 className="mb-3 text-lg font-bold text-ink">Before you make this routine</h2>
            <p className="text-sm leading-relaxed text-muted">
              Taking several separate payments from a customer is ordinary commercial practice, and
              nothing here bypasses any control in the payment system. Acquirer agreements differ,
              though, and some restrict deliberately structuring transactions to avoid fees. Check
              your own merchant agreement before relying on this day to day — and remember that if
              your customer is paying by bank-funded UPI or RuPay debit, there was no MDR to avoid in
              the first place.
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-bold text-ink">Related tools</h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/calculators/mdr-calculator"
                className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
              >
                MDR Calculator
              </Link>
              <Link
                href="/tools/upi-qr-generator"
                className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
              >
                UPI QR Generator
              </Link>
              <Link
                href="/tools/invoice-generator"
                className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
              >
                Invoice Generator
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-16">
        <GlossaryTermsStrip type="tool" slug="upi-qr-split" />
      </section>
    </>
  );
}
