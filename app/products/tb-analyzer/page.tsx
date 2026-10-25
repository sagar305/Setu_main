import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  BarChart3,
  Building2,
  CalendarRange,
  CircleSlash,
  ClipboardList,
  Coins,
  Cpu,
  DatabaseBackup,
  FileSpreadsheet,
  FileText,
  Gauge,
  HelpCircle,
  Landmark,
  Layers,
  LineChart,
  ListChecks,
  Lock,
  Percent,
  Scale,
  ShieldCheck,
  Table2,
  Tags,
  Upload,
  Users,
  WifiOff,
} from "lucide-react";
import { Faq } from "@/components/Faq";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";
import { freeOffer } from "@/lib/schema";

/**
 * The tool itself is a separate static app, served on this domain by the
 * rewrite in next.config.js. The trailing slash matters: the app loads its
 * scripts by relative path. A plain <a>, not <Link>, because it is not a Next
 * route.
 */
const APP_HREF = "/products/tb-analyzer/app/";

export const metadata: Metadata = {
  title: "TB Analyzer — Free Trial Balance Analysis | Setu",
  description:
    "Free trial balance analyser for CAs. Compare three periods, get P&L, Balance Sheet, 15 ratios and Excel/PDF review packs — nothing is uploaded.",
  keywords: [
    "trial balance analyzer",
    "trial balance analysis",
    "free trial balance analyser",
    "TB analysis tool",
    "financial ratio analysis from trial balance",
    "trial balance to balance sheet",
    "CA financial review tool",
    "three year financial comparison",
    "offline trial balance software",
    "trial balance software India",
  ],
  alternates: { canonical: "/products/tb-analyzer" },
  openGraph: {
    title: "TB Analyzer — Free, Private Trial Balance Analysis",
    description:
      "Import trial balances for up to three periods, review the statements, ratios and drivers, and export a review pack. Runs entirely in your browser.",
    url: "/products/tb-analyzer",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology TB Analyzer",
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
  { icon: FileSpreadsheet, label: "XLSX · XLS · XLSM · CSV" },
  { icon: CalendarRange, label: "Three periods" },
  { icon: Layers, label: "Up to 20 workbooks" },
  { icon: Percent, label: "15 ratios" },
  { icon: Users, label: "Peer comparison" },
  { icon: FileText, label: "Excel & PDF review packs" },
  { icon: WifiOff, label: "Works offline" },
];

const CORE: Feature[] = [
  {
    icon: Upload,
    title: "Import client workbooks",
    description:
      "One or several Excel or CSV workbooks at once — up to 20 files, 10 MB each. Files are read by your browser, never uploaded to a server.",
  },
  {
    icon: Layers,
    title: "Layouts it recognises",
    description:
      "Separate yearly sheets, year-labelled debit/credit columns and year-labelled signed closing columns. Title rows and repeated headers are handled.",
  },
  {
    icon: Table2,
    title: "Manual mapping when needed",
    description:
      "An unrecognised or undated layout opens a mapping screen: pick the worksheet, header row, account, debit and credit columns before anything is saved.",
  },
  {
    icon: CalendarRange,
    title: "Period dates you can see",
    description:
      "When only a year is given, your financial-year start is used and the assumption is recorded. Exact start and end dates can be edited; overlapping periods are rejected.",
  },
  {
    icon: Coins,
    title: "Currency detected, never converted",
    description:
      "Explicit currency metadata and symbols are read. A lone dollar sign is not taken as USD, conflicts ask for review, and no exchange-rate conversion is applied.",
  },
  {
    icon: Scale,
    title: "Unbalanced TBs stay unbalanced",
    description:
      "An unbalanced trial balance remains visible with its reconciliation error. No rounding plug is inserted to force it to agree.",
  },
];

const CLASSIFY: FeatureSection = {
  eyebrow: "Classification",
  title: "Suggested groups, confirmed by you",
  subtitle:
    "Accounts are given a suggested group from their names. That suggestion is a draft — the statements and ratios only count once you have reviewed and confirmed it.",
  items: [
    {
      icon: Tags,
      title: "Name-based suggestions",
      description:
        "Each account gets a suggested ratio group. You change any that are wrong before the numbers are relied on.",
    },
    {
      icon: AlertTriangle,
      title: "Unmapped means unavailable",
      description:
        "An account without a group suppresses the statement and ratio values it would affect, instead of quietly leaving it out.",
    },
    {
      icon: ListChecks,
      title: "Completeness confirmed per period",
      description:
        "You confirm each period includes complete income, expenses, stock adjustments and closing balances before its figures are treated as final.",
    },
  ],
};

const ANALYSIS: FeatureSection = {
  eyebrow: "Analysis",
  title: "From three trial balances to a review",
  subtitle:
    "Every figure is computed on your device in whole currency units, with integer arithmetic so totals do not drift.",
  items: [
    {
      icon: FileSpreadsheet,
      title: "P&L, Balance Sheet and Cash Flow",
      description:
        "Three statement tables side by side for each period. Cash flow uses the amounts you enter from a cash-flow statement and is checked against the TB's closing cash.",
    },
    {
      icon: Percent,
      title: "15 ratios, explained",
      description:
        "Revenue growth, gross, EBITDA and PAT margins, current and quick ratios, debt/equity, interest cover, ROE, CFO/PAT, return on average assets, receivable, inventory and payable days, and the cash conversion cycle.",
    },
    {
      icon: LineChart,
      title: "Variance and common size",
      description:
        "Absolute and percentage movements between periods, with P&L sized against revenue and the Balance Sheet against total assets.",
    },
    {
      icon: BarChart3,
      title: "EBITDA bridge",
      description:
        "A waterfall from prior EBITDA through revenue, other income and cost contributions to the latest EBITDA.",
    },
    {
      icon: Gauge,
      title: "Working capital",
      description:
        "Receivable, inventory and payable days on actual period length, and the cash conversion cycle they add up to.",
    },
    {
      icon: Users,
      title: "Peer comparison",
      description:
        "Import a real peer's TBs and compare side by side. No invented industry benchmarks are used.",
    },
    {
      icon: HelpCircle,
      title: "Management questions",
      description:
        "Large account movements, margin shifts, cash-cycle changes, weak liquidity, losses and low interest cover become review questions to put to management.",
    },
    {
      icon: ShieldCheck,
      title: "Evidence & checks",
      description:
        "Reconciliation, cash-flow arithmetic and data checks in one place, with source rows, GL codes and worksheet names kept for review.",
    },
  ],
};

const EXPORTS: FeatureSection = {
  eyebrow: "Exports",
  title: "A review pack for the file",
  subtitle:
    "Both packs cover every loaded client and are generated on your device — no email step, no cloud render.",
  items: [
    {
      icon: FileSpreadsheet,
      title: "Excel review pack",
      description:
        "Statements, variances, common size, all 15 ratios, working capital, the EBITDA bridge, findings, checks, peer comparisons and account-level source TBs, with frozen, formatted headers.",
    },
    {
      icon: FileText,
      title: "PDF review pack",
      description:
        "The same review in a printable document, with revenue and EBITDA waterfall charts.",
    },
    {
      icon: ClipboardList,
      title: "Three-period template",
      description:
        "Download a workbook laid out the way the importer expects, replace the illustrative balances, and import all three sheets together.",
    },
  ],
};

const PRIVACY: Feature[] = [
  {
    icon: Cpu,
    title: "No AI, no API keys",
    description:
      "Classification, calculations, charts and questions are deterministic code running in the browser. There are no AI calls.",
  },
  {
    icon: Ban,
    title: "No upload, ever",
    description:
      "Workbooks are parsed in your browser. There is no upload or analysis endpoint for them to go to.",
  },
  {
    icon: CircleSlash,
    title: "No analytics, no cloud services",
    description:
      "The app makes no network calls with your data and loads no third-party scripts at runtime.",
  },
  {
    icon: Lock,
    title: "No login, no account",
    description: "Open the page and start. There is nothing to sign up for.",
  },
  {
    icon: WifiOff,
    title: "Offline after the first visit",
    description:
      "The app caches its own code once loaded, so it keeps working without internet. Client TBs are never cached.",
  },
  {
    icon: DatabaseBackup,
    title: "Gone when you close the tab",
    description:
      "Financial data stays in page memory only. Refreshing or closing clears it, and only your financial-year start month is remembered.",
  },
];

const LIMITS: { icon: ComponentType<{ className?: string }>; title: string; body: string }[] = [
  {
    icon: Landmark,
    title: "Not a statutory statement",
    body: "The P&L and Balance Sheet are built from mapped TB balances. This is not a statutory statement or an accounting-adjustment engine.",
  },
  {
    icon: CalendarRange,
    title: "Ageing and maturities need evidence a TB does not have",
    body: "Debtor and creditor ageing, stock obsolescence, debt maturities and actual operating, investing and financing cash flows cannot be established from a trial balance alone.",
  },
  {
    icon: Coins,
    title: "No currency conversion or scaling",
    body: "Figures are taken in whole currency units. There is no exchange-rate conversion, and amounts in thousands or lakhs are not scaled automatically.",
  },
  {
    icon: Building2,
    title: "Use period activity, not year-to-date",
    body: "Each TB should hold standalone activity for its period. Cumulative year-to-date TBs will overstate the later periods.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Does my trial balance get uploaded anywhere?",
    answer:
      "No. The workbook is read by your browser, and parsing, classification, calculations, charts and the review packs are all produced on your device. There is no server step for your data.",
  },
  {
    question: "Does this use AI?",
    answer:
      "No. Account suggestions come from name-based rules, and every calculation is deterministic. The same trial balance always produces the same result, and suggested groups are drafts for you to confirm.",
  },
  {
    question: "Which file formats can I import?",
    answer:
      "XLSX, XLS, XLSM and CSV — up to 20 files at a time, 10 MB each. Each client can hold up to three periods, either as separate sheets or as year-labelled columns in one sheet.",
  },
  {
    question: "Which ratios does it calculate?",
    answer:
      "Fifteen: revenue growth, gross margin, EBITDA margin, PAT margin, current ratio, quick ratio, debt/equity, interest coverage, ROE, CFO/PAT, return on average assets, receivable days, inventory days, payable days and the cash conversion cycle. Each comes with an explanation of how it was worked out.",
  },
  {
    question: "What if my trial balance does not balance?",
    answer:
      "It stays unbalanced. The difference is shown as a reconciliation error and carried into the checks — nothing is plugged to make it agree.",
  },
  {
    question: "Is my work saved?",
    answer:
      "No — by design, financial data lives only in the open page. Refreshing or closing the tab clears it, so export the Excel or PDF review pack before you leave.",
  },
  {
    question: "Does it work offline?",
    answer:
      "Yes, after the first visit. The app caches its own code so it opens and runs without internet; it never caches client trial balances.",
  },
  {
    question: "Is it really free?",
    answer:
      "Yes. No signup, no trial, no card. It is one of Setu's free tools, in the same family as the Bank Statement Analyzer and the Browser Based POS.",
  },
];

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Setu TB Analyzer",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "Free browser-based trial balance analyser for chartered accountants. Import up to three periods of trial balances from Excel or CSV, review P&L, Balance Sheet and Cash Flow, 15 ratios, working capital and management questions, and export Excel and PDF review packs. All processing happens on the device.",
  featureList: [
    "XLSX, XLS, XLSM and CSV trial balance import",
    "Up to 20 workbooks and three periods per client",
    "Automatic layout detection with manual mapping",
    "Suggested account groups for review",
    "P&L, Balance Sheet and Cash Flow statements",
    "15 financial ratios with explanations",
    "Variance and common-size analysis",
    "EBITDA waterfall bridge",
    "Working capital and cash conversion cycle",
    "Management findings and review questions",
    "Peer company comparison",
    "Excel and PDF review packs",
    "Works offline after first visit",
    "No upload, no login, no analytics",
  ],
  offers: freeOffer({ url: "/products/tb-analyzer" }),
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

export default function TbAnalyzerPage() {
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
              TB Analyzer — Trial Balance Analysis
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
              Compare three periods of trial balances, understand what drove the change, and export
              a review pack — all in your browser.
            </p>
            <a
              href={APP_HREF}
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-indigo px-6 py-3 text-base font-semibold text-white transition hover:bg-indigo/90"
            >
              Open TB Analyzer — it&apos;s free
              <ArrowRight className="h-4 w-4" />
            </a>
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

      {/* Sample prompt */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <FadeIn>
            <h2 className="text-3xl font-bold tracking-tight text-ink">
              Try it without a client&apos;s file
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted">
              Open the analyzer and choose <strong>Analyse three-period sample</strong> to load
              synthetic, clearly labelled demonstration data — or download the three-period
              template and fill in your own balances.
            </p>
            <a
              href={APP_HREF}
              className="mt-6 inline-block rounded-lg bg-indigo px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo/90"
            >
              Open TB Analyzer
            </a>
          </FadeIn>
        </div>
      </section>

      {/* Core capabilities */}
      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <h2 className="text-center text-3xl font-bold tracking-tight text-ink">
              From client workbooks to a reviewed TB
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

      {/* Analysis — on indigo, because this is what people come back for */}
      <section className="bg-indigo py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionIntro section={ANALYSIS} onDark />
          <FeatureCards items={ANALYSIS.items} onDark />
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
                A client&apos;s trial balance is their whole financial position, so the answer to
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
                A review tool that overstates itself is worse than useless, so here is the honest
                edge of this version.
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
                    "Chartered accountants reviewing a client's financial position across years",
                    "Audit and accounting staff preparing analytical review working papers",
                    "Business owners who want to see what changed and why",
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
                    <strong>Important:</strong> because nothing is uploaded or stored, your
                    imported trial balances exist only while the page is open. Refreshing or
                    closing the tab clears them. Export the Excel or PDF review pack when you
                    finish — that file is your record.
                  </p>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.15}>
              <div>
                <h2 className="mb-4 text-2xl font-bold text-ink">Works well alongside</h2>
                <div className="flex flex-wrap gap-3">
                  {[
                    { href: "/products/bank-statement-analyzer", label: "Bank Statement Analyzer" },
                    { href: "/tools/trial-balance", label: "Trial Balance" },
                    { href: "/tools/profit-loss-statement", label: "Profit & Loss Statement" },
                    { href: "/tools/balance-sheet", label: "Balance Sheet" },
                    { href: "/calculators/financial-ratio-calculator", label: "Financial Ratio Calculator" },
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

      <Faq headline="TB Analyzer — questions" items={FAQ_ITEMS} />
    </>
  );
}
