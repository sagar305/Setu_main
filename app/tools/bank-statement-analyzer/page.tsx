import type { Metadata } from "next";
import Link from "next/link";
import { GlossaryTermsStrip } from "@/components/glossary/GlossaryTermsStrip";
import { DEMO_TOTALS } from "@/lib/bankStatement/demo/sampleStatement";

export const metadata: Metadata = {
  title: "Bank Statement Analyzer for CAs | Setu",
  description:
    "Analyse bank statements in your browser — classify transactions, spot cash and high-value entries, and export CA reports. Free, no signup, no upload.",
  keywords: [
    "bank statement analyzer",
    "bank statement analysis software",
    "bank statement to excel",
    "CA bank statement tool",
    "bank statement classification",
  ],
  alternates: { canonical: "/tools/bank-statement-analyzer" },
  openGraph: {
    title: "Bank Statement Analyzer",
    description:
      "Analyse bank statements directly in your browser. Your financial data stays on your device.",
    url: "/tools/bank-statement-analyzer",
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
      name: "Is my bank statement uploaded to a server?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. The file is read by your browser and every step — parsing, classification, analysis and report generation — runs on your device. Nothing is sent to Setu or to any third party, and there is no login.",
      },
    },
    {
      "@type": "Question",
      name: "Which file formats can I import?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PDF, XLSX, XLS and CSV. Password-protected PDFs are supported — you are asked for the password, which is used in memory and never stored. Scanned PDFs with no text layer are not supported in this version.",
      },
    },
    {
      "@type": "Question",
      name: "How do I know the extraction is complete?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Every import is checked against the statement's own running balance. If rows do not reconcile, the tool reports how many were extracted and how many are unresolved instead of showing a tidy number, and the warning is carried into the exported reports.",
      },
    },
    {
      "@type": "Question",
      name: "Can I analyse several statements together?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Import as many statements as you need and tick the ones to analyse together. Transactions that appear in more than one file because the periods overlap are flagged as duplicates and excluded from totals until you say otherwise.",
      },
    },
  ],
};

const STEPS = [
  {
    title: "Import",
    body: "Drop a PDF, XLSX, XLS or CSV. We detect the bank, the columns and the date format, and show you what we read before anything is saved.",
  },
  {
    title: "Review",
    body: "Every transaction with its category, party and confidence. Bulk-categorise, mark business or personal, and turn any narration into a reusable rule.",
  },
  {
    title: "Analyze",
    body: "Monthly cash flow, category breakdowns, cash and high-value transactions, top counterparties and the entries worth a second look.",
  },
  {
    title: "Export",
    body: "An Excel workbook with every CA report as a sheet, a formatted PDF, or a plain CSV for Tally and your working papers.",
  },
];

export default function BankStatementAnalyzerPage() {
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
            Bank Statement Analyzer for Chartered Accountants
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            Analyze bank statements directly in your browser. Your financial data stays on your
            device.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/tools/bank-statement-analyzer/import"
              className="rounded-lg bg-indigo px-6 py-3 text-base font-semibold text-white transition hover:bg-indigo/90"
            >
              Upload Statement
            </Link>
            <Link
              href="/tools/bank-statement-analyzer/import?demo=1"
              className="rounded-lg border border-indigo/30 px-6 py-3 text-base font-semibold text-indigo transition hover:bg-indigo/5"
            >
              Try Sample Statement
            </Link>
          </div>

          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            🔒 No upload, no login. All processing happens locally.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className="rounded-2xl border border-muted-line/30 bg-white p-6 shadow-sm"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-sm font-bold text-indigo">
                {index + 1}
              </span>
              <h2 className="mt-3 text-lg font-bold text-ink">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-16">
        <div className="rounded-2xl border border-muted-line/30 bg-cream-paper/50 p-8 text-center">
          <h2 className="text-2xl font-bold text-ink">Try it without a real statement</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
            The demo loads a synthetic statement for a fictional Indian services business —{" "}
            {DEMO_TOTALS.count} transactions, ₹18,42,000 in and ₹15,76,500 out — so you can see the
            whole workflow before you open a client&apos;s file.
          </p>
          <Link
            href="/tools/bank-statement-analyzer/import?demo=1"
            className="mt-5 inline-block rounded-lg bg-indigo px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo/90"
          >
            Load the demo statement
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-16">
        <h2 className="text-2xl font-bold text-ink">What it does not do</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          It does not read scanned statements — a PDF needs a text layer, so OCR is not in this
          version. It does not draw GST compliance conclusions: transactions can be flagged as GST
          relevant, but input tax credit eligibility, tax liability, place of supply and reverse
          charge are left to you. And bank-specific layout parsers are not yet verified against real
          statements, so every file is read with the generic layout engine and you are told when a
          row does not reconcile.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-16">
        <GlossaryTermsStrip type="tool" slug="bank-statement-analyzer" />
      </section>
    </>
  );
}
