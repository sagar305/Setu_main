import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  BadgeIndianRupee,
  Cake,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Link2,
  Lock,
  MessageCircle,
  NotebookPen,
  Percent,
  QrCode,
  Receipt,
  Share2,
  Sheet,
  ShieldCheck,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  Wallet,
  WifiOff,
} from "lucide-react";
import { TuitionApp } from "@/components/tools/Tuition/TuitionApp";
import { Faq } from "@/components/Faq";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";
import { freeOffer } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Free Tuition Class Management Software | Setu",
  description:
    "Free tuition software for student attendance, monthly fees, parent WhatsApp reminders, test marks and fee receipts. Works offline in your browser, no signup.",
  keywords: [
    "free tuition management software",
    "tuition class software",
    "coaching class attendance software",
    "tuition fees management app",
    "student attendance app free",
    "tuition fee receipt format",
    "coaching institute management software free",
    "home tutor app India",
  ],
  alternates: {
    canonical: "/products/free-tuition-software",
  },
  openGraph: {
    title: "Free Tuition Class Management Software",
    description:
      "Students, attendance, fees, parent reminders and test results — free, offline, no signup. Built for tuition teachers and coaching classes.",
    url: "/products/free-tuition-software",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Free Tuition Class Manager",
      },
    ],
  },
};

type Feature = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

const HIGHLIGHTS: { icon: ComponentType<{ className?: string }>; label: string }[] = [
  { icon: WifiOff, label: "Works offline" },
  { icon: Lock, label: "No signup" },
  { icon: MessageCircle, label: "WhatsApp parents" },
  { icon: Sheet, label: "Google Sheet sync" },
  { icon: Receipt, label: "Shareable fee receipts" },
];

const DAILY: Feature[] = [
  {
    icon: CalendarCheck,
    title: "Attendance in seconds",
    description:
      "Open today's batch, everyone starts marked present, tap the two who are missing and save. Present, absent, late and leave are all one tap on a phone.",
  },
  {
    icon: MessageCircle,
    title: "Tell parents about absences",
    description:
      "After saving, one button opens a queue of the absent students' parents with the message already written. Tap, send, next.",
  },
  {
    icon: Users,
    title: "Batches, not one big list",
    description:
      "Each batch has its own days, timing and fee. A student in two batches is marked in both and pays for both.",
  },
  {
    icon: CalendarDays,
    title: "Holidays that don't count against anyone",
    description:
      "Mark Diwali or a cancelled class as a holiday and the attendance screen warns you instead of leaving false absences on the record.",
  },
  {
    icon: NotebookPen,
    title: "A diary with dates",
    description:
      "Pin a reminder to any student and any date — \"ask for the pending assignment on Friday\". Unfinished notes keep showing until you tick them off.",
  },
  {
    icon: Cake,
    title: "Birthdays",
    description:
      "The Today screen shows whose birthday it is, with a one-tap wish to the parent. Small thing, remembered forever.",
  },
];

const FEES: Feature[] = [
  {
    icon: Wallet,
    title: "Fees that add themselves up",
    description:
      "The fee comes from the batch. Every active student's monthly due is raised automatically from their joining month onwards — no spreadsheet to maintain.",
  },
  {
    icon: Percent,
    title: "Concessions and custom fees",
    description:
      "A sibling discount, a scholarship or a flat custom amount for one student. The month's due is snapshotted when raised, so changing a batch fee never rewrites an old month.",
  },
  {
    icon: BadgeIndianRupee,
    title: "Admission, exam and book fees",
    description:
      "One-off charges sit alongside the monthly tuition fee and show up in the same outstanding balance.",
  },
  {
    icon: Receipt,
    title: "A receipt for every payment",
    description:
      "Collect a payment and get a numbered receipt instantly. Partial payments and advances are handled — the balance always tells the truth.",
  },
  {
    icon: Link2,
    title: "Receipts as a shareable link",
    description:
      "The receipt travels inside the link itself, so nothing is uploaded anywhere. Send it on WhatsApp and the parent opens a clean receipt page.",
  },
  {
    icon: QrCode,
    title: "Parents can pay from the link",
    description:
      "Add your UPI ID and every receipt and reminder carries a Pay now button and a QR — the parent pays straight into your account.",
  },
];

const PARENTS: Feature[] = [
  {
    icon: MessageCircle,
    title: "Fee reminders, one tap per parent",
    description:
      "The defaulter list is sorted by how overdue it is. \"Remind 9 parents\" opens each WhatsApp chat with the amount, the months and the payment link ready.",
  },
  {
    icon: ClipboardList,
    title: "Test marks to every parent",
    description:
      "Create a test for a batch, type the whole class's marks in one pass, then send each parent their own child's result — with the class average if you want it shown.",
  },
  {
    icon: Share2,
    title: "Monthly attendance reports",
    description:
      "Share a link showing the month's attendance percentage and the exact days missed. No more arguments about who came when.",
  },
  {
    icon: MessageCircle,
    title: "Your words, not ours",
    description:
      "Every message is a template you can rewrite — in English, Hindi or whatever your parents actually read. Placeholders fill in the name, amount and link.",
  },
];

const RUNNING: Feature[] = [
  {
    icon: Upload,
    title: "Bring your existing list",
    description:
      "Paste your students straight from a spreadsheet or a WhatsApp message, or upload a CSV. Eighty students in one go, not eighty forms.",
  },
  {
    icon: UserPlus,
    title: "Admission enquiries",
    description:
      "Every parent who calls or visits, with a follow-up date. The ones you call back are the ones who join.",
  },
  {
    icon: TrendingUp,
    title: "Reports that answer real questions",
    description:
      "What was collected this month, what is still out, and who has dropped below 75% attendance — on one screen, with CSV exports.",
  },
  {
    icon: FileSpreadsheet,
    title: "Google Sheet sync",
    description:
      "Push students, attendance, fees and marks into your own Google Sheet. It is your backup, your report, and it restores onto a new device.",
  },
  {
    icon: Download,
    title: "Backup and restore",
    description:
      "One file holds your whole class. Restoring it never touches the other Setu tools you use in the same browser.",
  },
  {
    icon: ShieldCheck,
    title: "PIN lock",
    description:
      "You are holding parents' phone numbers and fee records. A PIN with idle auto-lock keeps them off a borrowed phone.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Is this really free?",
    answer:
      "Yes. There is no login, no subscription and no trial. It runs entirely in your browser and stores everything on your device. Setu Tuition, the paid product, is a separate thing for institutes that need automated sending, parent logins and multiple teachers.",
  },
  {
    question: "Does it send WhatsApp messages automatically?",
    answer:
      "No, and it is honest about that. With no server and no login there is nothing that could send on your behalf. The app writes each message and opens WhatsApp with it ready — you tap send, one parent at a time. There is also a Copy all option if you use a bulk sender. Automatic sending needs a WhatsApp Business API account and is part of the paid Setu Tuition.",
  },
  {
    question: "How are fees calculated?",
    answer:
      "Each batch has a monthly fee, and a student pays the sum of the batches they are enrolled in, minus any concession you set. A custom amount can override that for one student. Dues are raised from each student's joining month onwards, and the amount is frozen when raised so changing a batch fee later never rewrites an old month.",
  },
  {
    question: "Can parents pay online?",
    answer:
      "Add your UPI ID in Settings and every fee receipt and reminder link carries a Pay now button and a UPI QR. The parent pays straight into your account — the money never passes through Setu. You then record the payment in the app.",
  },
  {
    question: "What happens to my data if I clear my browser?",
    answer:
      "It is gone, which is why the app pushes you to take a backup or connect a Google Sheet. Both restore a full class onto a new device or a new browser in one step.",
  },
  {
    question: "Does it work without internet?",
    answer:
      "Yes. Marking attendance, collecting fees, entering marks and everything else works fully offline. Only sending a WhatsApp message and syncing to Google Sheets need a connection, and changes queue up until you are back online.",
  },
  {
    question: "Can I use it for a coaching institute with many batches?",
    answer:
      "Yes — batches, per-batch fees, per-batch attendance and per-batch tests are all built in, and there is no limit on students. What it does not do yet is separate logins for other teachers or a view across multiple branches; that is what Setu Tuition adds.",
  },
  {
    question: "Do the receipt links expose my students' data?",
    answer:
      "The receipt or report is compressed into the link itself and decoded in the recipient's browser — nothing is stored on a server and there is no page anyone can browse to. Only a person holding that exact link sees that one document.",
  },
];

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Setu Free Tuition Class Manager",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Free tuition class management software for student records, daily attendance, monthly fees, parent reminders, test marks and shareable fee receipts. Works offline in the browser with all data stored on the device.",
  featureList: [
    "Students, batches and per-batch monthly fees",
    "Daily attendance with present, absent, late and leave",
    "WhatsApp absence notices to parents",
    "Automatic monthly fee dues with concessions",
    "Fee receipts with shareable links and UPI payment",
    "Fee reminders for every pending parent",
    "Tests with whole-batch marks entry and result sharing",
    "Dated diary reminders per student",
    "Admission enquiry register with follow-ups",
    "Attendance and collection reports with CSV export",
    "Bulk student import from CSV or a pasted list",
    "PIN lock, JSON backup and Google Sheet sync",
    "Works offline, no login required",
  ],
  offers: freeOffer({ url: "/products/free-tuition-software" }),
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

function FeatureCards({ items }: { items: Feature[] }) {
  return (
    <FadeInStagger className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <FadeInStaggerItem key={item.title}>
            <div className="group h-full rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-indigo/30 hover:shadow-md">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo/10 transition duration-300 group-hover:bg-indigo group-hover:text-white">
                <Icon className="h-5 w-5 text-indigo group-hover:text-white" />
              </div>
              <h3 className="mb-2 font-bold text-ink">{item.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{item.description}</p>
            </div>
          </FadeInStaggerItem>
        );
      })}
    </FadeInStagger>
  );
}

export default function FreeTuitionSoftwarePage() {
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

      <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
        <FadeIn>
          <div className="text-center">
            <div className="mb-4 inline-block rounded-full bg-indigo/10 px-4 py-2">
              <span className="text-sm font-semibold text-indigo">
                Free Tool — Works Offline
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              Tuition Class Manager
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
              Students, daily attendance, monthly fees, parent reminders and test results — for
              tuition teachers and coaching classes. No login, no subscription, no internet needed.
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
        <TuitionApp />
      </section>

      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                Every day
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                The five seconds before class starts
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Attendance is the one thing you do every single day, so it is built to be finished
                on a phone before the first question is asked.
              </p>
            </div>
          </FadeIn>
          <FeatureCards items={DAILY} />
        </div>
      </section>

      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                Fees
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                Know exactly who owes what
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Fees follow the batch. Dues raise themselves every month, receipts number
                themselves, and the outstanding list is always current.
              </p>
            </div>
          </FadeIn>
          <FeatureCards items={FEES} />
        </div>
      </section>

      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                Parents
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                Everything reaches the parent on WhatsApp
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Absences, fee reminders, receipts and results. The app writes the message and opens
                WhatsApp — you stay in control of what actually gets sent.
              </p>
            </div>
          </FadeIn>
          <FeatureCards items={PARENTS} />
        </div>
      </section>

      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                Running the class
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                Set up in a minute, safe for years
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Import the students you already have, keep track of new enquiries, and make sure a
                lost phone never means a lost class.
              </p>
            </div>
          </FadeIn>
          <FeatureCards items={RUNNING} />
        </div>
      </section>

      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-4xl px-6">
          <FadeIn>
            <div className="rounded-2xl border border-muted-line/20 bg-white p-8">
              <h2 className="text-2xl font-bold tracking-tight text-ink">
                Where the free tool stops
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Because everything runs in your browser with no account, the app cannot send a
                message on its own, cannot show parents a page that updates by itself, and cannot
                be used by two teachers on two devices with the same data. Those need a server —
                and that is exactly what{" "}
                <Link href="/products/tuition" className="font-semibold text-indigo hover:underline">
                  Setu Tuition
                </Link>{" "}
                is being built for. Everything on this page stays free.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/products/tuition"
                  className="inline-block rounded-full bg-indigo px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  See Setu Tuition →
                </Link>
                <Link
                  href="/tools"
                  className="inline-block rounded-full border border-muted-line/30 px-6 py-2.5 text-sm font-semibold text-ink transition hover:border-indigo/40 hover:text-indigo"
                >
                  All free tools
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <Faq headline="Free tuition software — questions" items={FAQ_ITEMS} />
    </>
  );
}
