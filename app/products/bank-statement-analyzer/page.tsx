import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ComponentType } from "react";
import {
  AlertTriangle,
  Ban,
  BarChart3,
  Banknote,
  BookOpen,
  Building2,
  Calculator,
  CalendarRange,
  CircleSlash,
  ClipboardList,
  Copy,
  Columns3,
  Cpu,
  DatabaseBackup,
  FileSpreadsheet,
  FileText,
  Filter,
  Gauge,
  History,
  KeyRound,
  Landmark,
  Layers,
  LineChart,
  ListChecks,
  Lock,
  Percent,
  PieChart,
  Receipt,
  Scale,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Tags,
  Undo2,
  Upload,
  Users,
  WifiOff,
} from "lucide-react";
import { ImportStep } from "@/components/tools/BankStatementAnalyzer/ImportStep";
import { StepNav } from "@/components/tools/BankStatementAnalyzer/StepNav";
import { SampleDownload } from "@/components/tools/BankStatementAnalyzer/SampleDownload";
import { Faq } from "@/components/Faq";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";
import { freeOffer } from "@/lib/schema";
import { DEMO_TOTALS } from "@/lib/bankStatement/demo/sampleStatement";

export const metadata: Metadata = {
  title: "Bank Statement Analyzer — Free, Private | Setu",
  description:
    "Free bank statement analyser for CAs. Import PDF, Excel or CSV, classify transactions, reconcile with your books and export reports — nothing is uploaded.",
  keywords: [
    "bank statement analyzer",
    "bank statement analysis software",
    "free bank statement analyser",
    "bank statement to excel",
    "CA bank statement tool",
    "bank statement classification",
    "bank statement reconciliation",
    "convert bank statement pdf to excel",
    "offline bank statement analyzer",
    "bank statement software India",
  ],
  alternates: { canonical: "/products/bank-statement-analyzer" },
  openGraph: {
    title: "Bank Statement Analyzer — Free, Private, No Upload",
    description:
      "Import a statement, classify every transaction, reconcile with your books and export CA reports. Runs entirely in your browser.",
    url: "/products/bank-statement-analyzer",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology Bank Statement Analyzer",
      },
    ],
  },
};

type Feature = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

type FeatureSection = {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: Feature[];
};

/** Quick badges under the hero — the things a CA scans for first. */
const HIGHLIGHTS: { icon: ComponentType<{ className?: string }>; label: string }[] = [
  { icon: Lock, label: "Nothing uploaded" },
  { icon: FileText, label: "PDF · XLSX · XLS · CSV" },
  { icon: KeyRound, label: "Password-protected PDFs" },
  { icon: Scale, label: "Balance-checked extraction" },
  { icon: Tags, label: "Rules-based classification" },
  { icon: Layers, label: "Multi-statement sessions" },
  { icon: FileSpreadsheet, label: "Excel & PDF reports" },
  { icon: WifiOff, label: "Works offline" },
];

const CORE: Feature[] = [
  {
    icon: Upload,
    title: "Import any statement format",
    description:
      "PDF with a text layer, XLSX, XLS or CSV, up to 100 MB. The file is read by your browser — it never travels to a server.",
  },
  {
    icon: KeyRound,
    title: "Password-protected PDFs",
    description:
      "Most bank statements arrive locked. Enter the password once and it is used in memory only — never stored, never logged, never sent anywhere.",
  },
  {
    icon: Columns3,
    title: "Column mapping you control",
    description:
      "We detect which column is the date, the narration, the debit, the credit and the balance — then show you, so you can correct anything we read wrong before it is saved.",
  },
  {
    icon: CalendarRange,
    title: "Date formats that do not guess",
    description:
      "01/02/2026 is read as DD/MM by default, and where a statement is genuinely ambiguous the tool asks you rather than silently picking one.",
  },
  {
    icon: Scale,
    title: "Extraction checked against the balance",
    description:
      "Every row is verified as previous balance + credit − debit. If the chain breaks, the statement is flagged — you are told what could and could not be resolved.",
  },
  {
    icon: Layers,
    title: "Several statements, one analysis",
    description:
      "Import Apr–Jun, Jul–Sep and Oct–Dec, tick the ones to analyse together, and overlapping periods are de-duplicated so income is never double counted.",
  },
];

const CLASSIFY: FeatureSection = {
  eyebrow: "Classification",
  title: "Deterministic, explainable, and yours to correct",
  subtitle:
    "Every transaction shows the category, the counterparty, a confidence figure and where that classification came from. No black box — if you disagree, you change it, and the tool remembers.",
  items: [
    {
      icon: ListChecks,
      title: "Your rules run first",
      description:
        "IF narration contains ABC ENTERPRISE THEN Purchases, party ABC Enterprise. Rules are ordered by priority, always beat pattern matching, and stay on your device.",
    },
    {
      icon: Sparkles,
      title: "Build a rule from a real transaction",
      description:
        "Click Rule on any row and a draft is written from that narration. Adjust it, see how many transactions it would claim, then save.",
    },
    {
      icon: Gauge,
      title: "Confidence you can read",
      description:
        "90–100% high, 70–89% medium, below that flagged for review. Confidence describes the classification only — never how well the file parsed.",
    },
    {
      icon: Users,
      title: "Business, personal or transfer",
      description:
        "A separate marking from the category, because an own-account transfer is neither business spend nor personal spend and should not be forced into either.",
    },
    {
      icon: Tags,
      title: "Categories that fit a set of books",
      description:
        "Sales, Purchases, Salaries, Rent, Professional Fees, GST, TDS, Bank Charges and more — rename, reorder, archive or add your own.",
    },
    {
      icon: Copy,
      title: "Duplicates found, not merged",
      description:
        "Same date, same amount, same reference across statements gets flagged and kept out of totals until you decide to keep it.",
    },
  ],
};

const REVIEW: FeatureSection = {
  eyebrow: "Review",
  title: "Built for someone working through a thousand rows",
  subtitle:
    "The review screen is where the hours go, so it is the screen that had to be fast. Rows are virtualised, filters are one click, and nothing is destructive.",
  items: [
    {
      icon: Table2,
      title: "Thousands of rows, no pagination",
      description:
        "The table renders only what is on screen, so a 5,000-line statement scrolls as one continuous ledger with the header pinned.",
    },
    {
      icon: Filter,
      title: "Filters that match the work",
      description:
        "Needs review, possible duplicates, high value, extraction issues, uncategorised, by direction, by category or by marking.",
    },
    {
      icon: ClipboardList,
      title: "Bulk everything",
      description:
        "Select a run of rows and categorise, mark business or personal, mark transfer, or override a duplicate in one action.",
    },
    {
      icon: Undo2,
      title: "Undo",
      description:
        "Every edit and bulk action can be stepped back, so trying a categorisation across fifty rows costs nothing.",
    },
    {
      icon: Search,
      title: "Counterparty extracted from the narration",
      description:
        "UPI/DR/402318/SWIGGY/UTIB becomes Swiggy — and where nothing looks like a name, the field is left empty rather than filled with a guess.",
    },
    {
      icon: History,
      title: "Local activity log",
      description:
        "What you imported, edited, ruled and exported, kept on the device. It never records account numbers, passwords or file contents.",
    },
  ],
};

const ANALYSIS: FeatureSection = {
  eyebrow: "Analysis",
  title: "The reports a CA actually opens",
  subtitle:
    "Every figure respects the duplicate policy and the extraction warnings, so what you see is what you can defend.",
  items: [
    {
      icon: LineChart,
      title: "Monthly cash flow",
      description:
        "Opening balance, credits, debits and closing balance month by month, charted and tabled, with the table view a click away.",
    },
    {
      icon: PieChart,
      title: "Expense and income analysis",
      description:
        "Every category ranked by amount with its share and transaction count — the working paper behind a P&L.",
    },
    {
      icon: Banknote,
      title: "Cash transactions",
      description:
        "Every deposit and withdrawal isolated, with totals, because cash is the first thing anyone reviewing the books asks about.",
    },
    {
      icon: AlertTriangle,
      title: "High-value transactions",
      description:
        "A configurable threshold, ₹1,00,000 by default, applied live — change it and the report re-cuts immediately.",
    },
    {
      icon: Users,
      title: "Top counterparties",
      description:
        "Who money went to and came from across the period, with counts, so concentration and unfamiliar names stand out.",
    },
    {
      icon: Receipt,
      title: "Bank charges, interest and transfers",
      description:
        "Three separate reports, because each one is a different journal entry and hunting them through a statement by eye is miserable.",
    },
    {
      icon: ListChecks,
      title: "Uncategorised — needs review",
      description:
        "The list that matters most: everything the tool would not commit to, waiting for your judgement.",
    },
    {
      icon: BarChart3,
      title: "Worth a look",
      description:
        "Round-tripping within two days, weekend cash, a month of spending double the median, and any row where the balance chain broke.",
    },
  ],
};

const RECONCILE: FeatureSection = {
  eyebrow: "Reconciliation",
  title: "Statement against books, matched three ways",
  subtitle:
    "Import a ledger export from Tally, Excel or anywhere else. Any column layout works — the columns are detected and you correct them.",
  items: [
    {
      icon: ShieldCheck,
      title: "Exact match first",
      description:
        "Same date, same amount, same reference. These are settled before anything looser is attempted.",
    },
    {
      icon: CalendarRange,
      title: "Then a date window",
      description:
        "Same amount within two days, marked as a likely match rather than a certainty, for you to confirm or reject.",
    },
    {
      icon: Search,
      title: "Then narration similarity",
      description:
        "Same amount within three days with a similar description — explainable token overlap, not a model you cannot audit.",
    },
    {
      icon: Percent,
      title: "Near misses surfaced, never merged",
      description:
        "An amount that is close but not equal is reported as a mismatch with the difference shown, because that difference is usually the point.",
    },
    {
      icon: SlidersHorizontal,
      title: "You confirm the uncertain ones",
      description:
        "Likely matches and mismatches carry Confirm and Reject, and the summary updates as you work through them.",
    },
    {
      icon: BookOpen,
      title: "Manual BRS still available",
      description:
        "For the classic reconciling-items statement — uncleared cheques, deposits in transit, charges — the Bank Reconciliation tool is one click away.",
    },
  ],
};

const EXPORTS: FeatureSection = {
  eyebrow: "Exports",
  title: "Take it into your working papers",
  subtitle:
    "Generated on your device. No email step, no cloud render, no link that expires.",
  items: [
    {
      icon: FileSpreadsheet,
      title: "Excel workbook, one sheet per report",
      description:
        "Statements, transactions, transaction summary, monthly summary, expense analysis, cash, high value, uncategorised, bank charges, interest, transfers, counterparties and GST-relevant.",
    },
    {
      icon: FileText,
      title: "Formatted PDF report",
      description:
        "Summary, monthly movement, expense and income analysis, cash, high value, uncategorised and counterparties — with extraction warnings on the first page.",
    },
    {
      icon: Table2,
      title: "Transactions CSV",
      description:
        "The full list with categories, parties, confidence and duplicate flags, ready for Tally or your own schedule.",
    },
    {
      icon: DatabaseBackup,
      title: "Warnings travel with the report",
      description:
        "If a statement did not fully reconcile, both the workbook and the PDF say so up front — so whoever reads it sees what you saw.",
    },
  ],
};

const PRIVACY: Feature[] = [
  {
    icon: Cpu,
    title: "No AI, cloud or offline",
    description:
      "Classification is a rules engine and a keyword table you can read in the source. There is no model on a server and no model on your device.",
  },
  {
    icon: Ban,
    title: "No upload, ever",
    description:
      "There is not a single network call in the analyzer. An automated test scans the source on every run and fails the build if one appears.",
  },
  {
    icon: CircleSlash,
    title: "No analytics, no telemetry",
    description:
      "No transaction data, no file metadata, no narrations, no account information. Nothing is measured, because nothing is sent.",
  },
  {
    icon: Lock,
    title: "No login, no account",
    description:
      "Open the page and start. There is nothing to sign up for and no identity attached to your work.",
  },
  {
    icon: ShieldCheck,
    title: "Account numbers masked on sight",
    description:
      "Only the last four digits are ever kept, and the PDF password is never written to storage at all.",
  },
  {
    icon: DatabaseBackup,
    title: "Your data, deletable in one click",
    description:
      "Statements, rules and categories live in this browser. Clear all local data removes every trace of them.",
  },
];

const LIMITS: { icon: ComponentType<{ className?: string }>; title: string; body: string }[] = [
  {
    icon: FileText,
    title: "Scanned statements are not supported yet",
    body: "A PDF needs a text layer. OCR for scanned or photographed statements is not in this version, and the tool tells you plainly instead of returning an empty result.",
  },
  {
    icon: Landmark,
    title: "Bank-specific parsers are not yet verified",
    body: "Adapters for HDFC, SBI, ICICI, Axis, Kotak, PNB, Bank of Baroda and Yes Bank are built, but until each is proven against real anonymised statements every file is read with the generic layout engine — and the screen says so.",
  },
  {
    icon: Calculator,
    title: "GST identification, not GST compliance",
    body: "Transactions can be flagged as GST relevant or potentially relevant. Input tax credit eligibility, tax liability, place of supply and reverse charge need context this tool does not have, so it does not pretend to.",
  },
  {
    icon: Building2,
    title: "Large statements prefer a desktop",
    body: "Import, review and the dashboard all work on a phone, but a 50 MB PDF is much faster on a laptop and you will be told so before you wait.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Does my bank statement get uploaded anywhere?",
    answer:
      "No. The file is read by your browser and every step — parsing, classification, analysis and report generation — runs on your device. There is no server call in the tool at all, and an automated test fails the build if one is ever added.",
  },
  {
    question: "Does this use AI?",
    answer:
      "No — neither cloud AI nor an offline model. Transactions are classified by a deterministic rules engine plus a keyword table written for Indian bank narrations. The same statement always produces the same result, and every classification shows exactly which rule or pattern produced it. Nothing is downloaded to run a model on your device either.",
  },
  {
    question: "Which formats can I import?",
    answer:
      "PDF with a text layer, XLSX, XLS and CSV, up to 100 MB. Password-protected PDFs are supported — you are asked for the password, which is used in memory and never stored. Scanned PDFs with no text layer are not supported in this version.",
  },
  {
    question: "How do I know every transaction was extracted?",
    answer:
      "Each import is checked against the statement's own running balance: previous balance plus credit minus debit must equal the next balance. If that chain breaks, the statement is marked unresolved and you are told how many rows were extracted and how many were not, rather than being shown a tidy number. The warning is carried into the exported reports too.",
  },
  {
    question: "Can I analyse several statements together?",
    answer:
      "Yes. Import as many as you need and tick the ones to analyse together. Transactions appearing in more than one file because the periods overlap are flagged as duplicates and excluded from totals until you say otherwise.",
  },
  {
    question: "Is my classification work saved?",
    answer:
      "Yes, in this browser. Statements, transactions, rules and categories persist across reloads, so you can close the tab mid-review and come back. Nothing syncs to another device, and Clear all local data removes everything.",
  },
  {
    question: "Does it work offline?",
    answer:
      "Once the page has loaded, all processing is local, so an unstable connection will not interrupt your work. There is no service worker in this version, so the page itself still needs to be loaded once.",
  },
  {
    question: "Is it really free?",
    answer:
      "Yes. No signup, no trial, no card, no per-statement charge. It is one of Setu's free tools, in the same family as the Browser Based POS and the Invoice Generator.",
  },
];

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Setu Bank Statement Analyzer",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "Free browser-based bank statement analyser for chartered accountants. Import PDF, XLSX, XLS or CSV statements, classify transactions with a rules engine, reconcile against a ledger and export Excel and PDF reports. All processing happens on the device.",
  featureList: [
    "PDF, XLSX, XLS and CSV statement import",
    "Password-protected PDF support",
    "Automatic column mapping with manual correction",
    "Date-format detection that asks when ambiguous",
    "Running-balance validation of every extraction",
    "Deterministic rules-based transaction classification",
    "Business, personal and transfer marking",
    "Editable category tree",
    "Cross-statement duplicate detection",
    "Monthly cash flow, expense and income analysis",
    "Cash, high-value, bank charge, interest and transfer reports",
    "Ledger reconciliation with three-level matching",
    "Excel workbook, PDF report and CSV exports",
    "No upload, no login, no analytics",
  ],
  offers: freeOffer({ url: "/products/bank-statement-analyzer" }),
  provider: {
    "@type": "Organization",
    name: "Setu Technology",
    url: "https://setutechnology.com",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

function SectionIntro({ section, onDark = false }: { section: FeatureSection; onDark?: boolean }) {
  return (
    <FadeIn>
      <div className="mx-auto max-w-2xl text-center">
        <p
          className={`text-xs font-semibold uppercase tracking-[0.3em] ${
            onDark ? "text-saffron" : "text-muted-warm"
          }`}
        >
          {section.eyebrow}
        </p>
        <h2
          className={`mt-4 text-3xl font-bold tracking-tight ${
            onDark ? "text-cream-paper" : "text-ink"
          }`}
        >
          {section.title}
        </h2>
        <p className={`mt-4 leading-relaxed ${onDark ? "text-cream-paper/75" : "text-muted"}`}>
          {section.subtitle}
        </p>
      </div>
    </FadeIn>
  );
}

function FeatureCards({ items, onDark = false }: { items: Feature[]; onDark?: boolean }) {
  return (
    <FadeInStagger className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <FadeInStaggerItem key={item.title}>
            <div
              className={`group h-full rounded-xl border p-6 transition duration-300 ${
                onDark
                  ? "border-cream-paper/15 bg-white/5 hover:border-saffron/40 hover:bg-white/10"
                  : "border-muted-line/20 bg-white shadow-sm hover:-translate-y-1 hover:border-indigo/30 hover:shadow-md"
              }`}
            >
              <div
                className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg transition duration-300 ${
                  onDark
                    ? "bg-saffron/20 group-hover:bg-saffron/30"
                    : "bg-indigo/10 group-hover:bg-indigo group-hover:text-white"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${
                    onDark ? "text-saffron" : "text-indigo group-hover:text-white"
                  }`}
                />
              </div>
              <h3 className={`mb-2 font-bold ${onDark ? "text-cream-paper" : "text-ink"}`}>
                {item.title}
              </h3>
              <p
                className={`text-sm leading-relaxed ${
                  onDark ? "text-cream-paper/75" : "text-muted"
                }`}
              >
                {item.description}
              </p>
            </div>
          </FadeInStaggerItem>
        );
      })}
    </FadeInStagger>
  );
}

export default function BankStatementAnalyzerPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Page header */}
      <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
        <FadeIn>
          <div className="text-center">
            <div className="mb-4 inline-block rounded-full bg-indigo/10 px-4 py-2">
              <span className="text-sm font-semibold text-indigo">Free Product — Nothing Uploaded</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              Bank Statement Analyzer
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
              Analyze bank statements directly in your browser. Your financial data stays on your
              device.
            </p>
          </div>
        </FadeIn>

        <FadeInStagger className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-2.5">
          {HIGHLIGHTS.map((highlight) => {
            const Icon = highlight.icon;
            return (
              <FadeInStaggerItem key={highlight.label}>
                <span className="inline-flex items-center gap-2 rounded-full border border-muted-line/30 bg-white px-3.5 py-1.5 text-sm font-semibold text-ink shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo/40 hover:text-indigo">
                  <Icon className="h-4 w-4 text-indigo" />
                  {highlight.label}
                </span>
              </FadeInStaggerItem>
            );
          })}
        </FadeInStagger>
      </section>

      {/* The app itself */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <StepNav />
        {/* ImportStep reads ?demo=1, so it needs a boundary to prerender. */}
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <ImportStep />
        </Suspense>
      </section>

      {/* Demo prompt */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <FadeIn>
            <h2 className="text-3xl font-bold tracking-tight text-ink">
              Try it without a real statement
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted">
              The demo loads a synthetic statement for a fictional Indian services business —{" "}
              {DEMO_TOTALS.count} transactions, ₹18,42,000 in and ₹15,76,500 out — so you can walk
              the whole workflow before you open a client&apos;s file.
            </p>
            <Link
              href="/products/bank-statement-analyzer/import?demo=1"
              className="mt-6 inline-block rounded-lg bg-indigo px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo/90"
            >
              Load the demo statement
            </Link>

            <div className="mt-10 border-t border-muted-line/30 pt-8">
              <SampleDownload />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Core capabilities */}
      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <h2 className="text-center text-3xl font-bold tracking-tight text-ink">
              From a locked PDF to a reviewed set of books
            </h2>
          </FadeIn>
          <FeatureCards items={CORE} />
        </div>
      </section>

      {/* Classification */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionIntro section={CLASSIFY} />
          <FeatureCards items={CLASSIFY.items} />
        </div>
      </section>

      {/* Review */}
      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionIntro section={REVIEW} />
          <FeatureCards items={REVIEW.items} />
        </div>
      </section>

      {/* Analysis — on indigo, because this is what people come back for */}
      <section className="bg-indigo py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionIntro section={ANALYSIS} onDark />
          <FeatureCards items={ANALYSIS.items} onDark />
        </div>
      </section>

      {/* Reconciliation */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionIntro section={RECONCILE} />
          <FeatureCards items={RECONCILE.items} />
        </div>
      </section>

      {/* Exports */}
      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionIntro section={EXPORTS} />
          <FeatureCards items={EXPORTS.items} />
        </div>
      </section>

      {/* Privacy & the AI question */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                Privacy
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                No AI. No upload. No account.
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Client bank data is about as sensitive as it gets, so the answer to
                &ldquo;where does it go?&rdquo; is: nowhere. Not to us, not to a model, not to an
                analytics service.
              </p>
            </div>
          </FadeIn>
          <FeatureCards items={PRIVACY} />
        </div>
      </section>

      {/* Honest limits */}
      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-4xl px-6">
          <FadeIn>
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-ink">
                What it does not do
              </h2>
              <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-muted">
                Accounting software that overstates itself is worse than useless, so here is the
                honest edge of this version.
              </p>
            </div>
          </FadeIn>

          <FadeInStagger className="mt-10 space-y-4">
            {LIMITS.map((limit) => {
              const Icon = limit.icon;
              return (
                <FadeInStaggerItem key={limit.title}>
                  <div className="flex gap-4 rounded-xl border border-muted-line/20 bg-cream-paper/60 p-5">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-saffron/20">
                      <Icon className="h-4 w-4 text-ink" />
                    </span>
                    <div>
                      <h3 className="font-bold text-ink">{limit.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted">{limit.body}</p>
                    </div>
                  </div>
                </FadeInStaggerItem>
              );
            })}
          </FadeInStagger>
        </div>
      </section>

      {/* Who it is for + data safety + related */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="space-y-8">
            <FadeIn>
              <div>
                <h2 className="mb-4 text-2xl font-bold text-ink">Who is this for?</h2>
                <ul className="space-y-2 text-muted">
                  {[
                    "Chartered accountants working through a client's year of statements",
                    "Accounting and audit staff preparing schedules and working papers",
                    "Bookkeepers reconciling a bank statement against the ledger each month",
                    "Business owners who want to see where the money actually went",
                  ].map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="text-indigo">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div>
                <h2 className="mb-4 text-2xl font-bold text-ink">Keep your work safe</h2>
                <div className="rounded-lg border-l-4 border-saffron bg-saffron/10 p-4">
                  <p className="text-sm text-muted">
                    <strong>Important:</strong> because nothing is uploaded, your imported
                    statements, rules and categories live only in this browser. If you clear site
                    data or switch device, they are gone. Export the Excel workbook when you finish
                    a review — that file is your record.
                  </p>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.15}>
              <div>
                <h2 className="mb-4 text-2xl font-bold text-ink">Works well alongside</h2>
                <div className="flex flex-wrap gap-3">
                  {[
                    { href: "/tools/bank-reconciliation", label: "Bank Reconciliation (manual BRS)" },
                    { href: "/tools/cash-book", label: "Cash Book" },
                    { href: "/tools/general-ledger", label: "General Ledger" },
                    { href: "/tools/profit-loss-statement", label: "Profit & Loss Statement" },
                    { href: "/tools/expense-tracker", label: "Expense Tracker" },
                  ].map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <Faq headline="Bank Statement Analyzer — questions" items={FAQ_ITEMS} />
    </>
  );
}
