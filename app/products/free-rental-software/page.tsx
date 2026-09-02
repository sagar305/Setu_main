import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { rentalSoftwareEnabled } from "@/lib/featureFlags";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  ClipboardList,
  Download,
  FileText,
  Lock,
  MessageCircle,
  PackageCheck,
  Printer,
  ScanLine,
  Sheet,
  ShieldCheck,
  Signature,
  Tent,
  Timer,
  TrendingUp,
  Truck,
  Wallet,
  WifiOff,
  Wrench,
} from "lucide-react";
import { RentalApp } from "@/components/tools/Rental/RentalApp";
import { Faq } from "@/components/Faq";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";
import { freeOffer } from "@/lib/schema";

/**
 * Metadata is generated rather than exported flat, because a flat export is
 * evaluated even when the component below calls notFound(). The rendered
 * <head> was already correct, but the RSC payload embedded in the 404 still
 * carried this page's title, description and OG tags — view-source on a page
 * that does not exist yet was showing an unreleased product's marketing copy.
 */
export function generateMetadata(): Metadata {
  if (!rentalSoftwareEnabled()) return {};
  return {
    title: "Free Rental Management Software for Tent & Equipment Hire",
    description:
      "Free rental software for tent houses, event and equipment hire. See what is free on any date, and settle damage and late fees at return.",
    keywords: [
      "rental management software free",
      "tent house software",
      "equipment rental software free download",
      "rental booking software India",
      "camera rental management software",
      "furniture rental billing software",
      "party equipment rental software",
      "free hire management software",
      "rental inventory availability calendar",
    ],
    alternates: {
      canonical: "/products/free-rental-software",
    },
    openGraph: {
      title: "Free Rental & Hire Book",
      description:
        "Never promise the same 200 chairs to two weddings. Free availability-first rental software that works offline, with no signup.",
      url: "/products/free-rental-software",
      type: "website",
      images: [
        {
          url: "/og/setu-og-image-1200x627.png",
          width: 1200,
          height: 627,
          alt: "Setu Free Rental & Hire Book",
        },
      ],
    },
  };
}

type Feature = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

const HIGHLIGHTS: { icon: ComponentType<{ className?: string }>; label: string }[] = [
  { icon: CalendarRange, label: "Real availability by date" },
  { icon: WifiOff, label: "Works offline" },
  { icon: Lock, label: "No signup" },
  { icon: Wallet, label: "Deposit settlement" },
  { icon: ShieldCheck, label: "Nothing leaves your device" },
];

const AVAILABILITY: Feature[] = [
  {
    icon: CalendarRange,
    title: "How many are free on the 14th?",
    description:
      "Pick a date range and every item tells you what is left. Not what is in the godown right now — what is left after everything already promised for those days, which is the number you actually quote against.",
  },
  {
    icon: AlertTriangle,
    title: "The tightest day, never the average",
    description:
      "Fifty chairs out on Monday and fifty on Friday is fifty committed across that week, not a hundred. Fifty on Monday and fifty also on Monday is a hundred. Getting that arithmetic wrong is how two weddings end up expecting the same stock, so it is the one thing this app is built around.",
  },
  {
    icon: ClipboardList,
    title: "A live check while you type the quantity",
    description:
      "The quantity box on a booking says “12 of 200 free on these dates” as you type, and refuses to save past it. You can still override — sub-hire is normal in this trade — but only by ticking a box that says you are covering the shortfall.",
  },
  {
    icon: Timer,
    title: "Buffer days and overdue stock, counted properly",
    description:
      "Stock comes back dirty and goes out again cleaned, so a booking holds its items for however many buffer days you set. And a booking that is three days late is holding that stock today, whatever the paperwork says — so the calendar keeps it held rather than promising it out.",
  },
];

const PIPELINE: Feature[] = [
  {
    icon: FileText,
    title: "Quote first, commit later",
    description:
      "An enquiry is a quotation: it prints, it shares, and it holds no stock. Quoting for a busy Saturday never makes that Saturday look full. Confirming is the moment the items are committed.",
  },
  {
    icon: Truck,
    title: "Picking lists with no prices on them",
    description:
      "The loading crew gets counts and tick boxes. Your hire rates do not go out to a marquee on a sheet of paper for the customer's staff to read — the challan they sign is a separate document.",
  },
  {
    icon: Signature,
    title: "Signed challans, both ways",
    description:
      "Capture a signature on the phone at delivery and again at return, and it prints on the challan and the settlement note. The argument three weeks later is much shorter.",
  },
  {
    icon: ScanLine,
    title: "Serial numbers where they matter",
    description:
      "Chairs are counted; a Canon body is not. Serialised items are ticked off unit by unit at dispatch, and the app enforces that a unit is on one booking at a time — the mistake serialised tracking exists to prevent.",
  },
  {
    icon: PackageCheck,
    title: "Return settlement in one screen",
    description:
      "How many came back, how many came back broken, how many did not come back. Damage at a percentage of replacement value, loss at full value, late days worked out from the calendar, and the deposit applied to whatever is left.",
  },
  {
    icon: Wrench,
    title: "Repairs take stock out of availability",
    description:
      "Twenty chairs at the welder for a week are twenty chairs you cannot promise that week. Log the repair with an out-of-service window and the calendar knows.",
  },
];

const AFTER: Feature[] = [
  {
    icon: TrendingUp,
    title: "Utilisation, in unit-days",
    description:
      "The most useful report in the app: what share of what you own was actually earning. Twenty of two hundred chairs out for three days is not “the chairs were busy” — it is 60 unit-days, and that is what tells you whether to buy more or sell some.",
  },
  {
    icon: BarChart3,
    title: "Revenue and return on cost, per item",
    description:
      "What each item earned, against what it cost to buy. The marquee that pays for itself in a season and the lighting rig that has not moved since March both show up.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp with a link the customer can open",
    description:
      "Quotes, confirmations, return reminders and overdue chases, from your own templates. Each one carries a link to the document itself — the customer opens it on their phone, sees the items and dates, and can pay by UPI. Turn on automatic shortening and every link is a short one without a second tap.",
  },
  {
    icon: Printer,
    title: "Every paper this trade needs",
    description:
      "Quotation, picking list, delivery challan, settlement note and invoice — on A4, A5 or a 58mm or 80mm thermal roll.",
  },
  {
    icon: Sheet,
    title: "Google Sheet backup",
    description:
      "Push bookings, items, utilisation and deposits held to your own sheet. One way only — a spreadsheet is never allowed to write back over a live booking.",
  },
  {
    icon: Download,
    title: "Your data, in a file",
    description:
      "CSV of every booking and every line, and a JSON backup you can carry to another device. Nothing is kept anywhere else.",
  },
];

const WHO = [
  "Tent houses and event decorators",
  "Party equipment and furniture hire",
  "Camera, lighting and sound rental",
  "Construction tools and scaffolding",
  "Crockery and utensil hire",
  "Wedding and exhibition contractors",
];

const FAQ_ITEMS = [
  {
    question: "Is this rental software really free?",
    answer:
      "Yes. No signup, no trial, no limit on items, bookings or customers. Everything runs inside your browser, so there is no server for us to charge you for.",
  },
  {
    question: "How does it stop me double-booking the same stock?",
    answer:
      "Every confirmed and dispatched booking commits its items for the days it covers. When you quote for a new date range, the app works out the busiest single day inside it and shows what is left after everything already promised. If you try to book past that it stops you, and tells you which item is short and on which day.",
  },
  {
    question: "What if I want to take the booking anyway and sub-hire the shortfall?",
    answer:
      "Tick “book anyway” and it saves. That is deliberate — borrowing stock from a peer to cover a busy Saturday is normal in this trade. The booking is marked as over-committed so it is visible later, and it stops nagging you about a decision you have already made.",
  },
  {
    question: "Does it handle deposits, damage and late returns?",
    answer:
      "That is the second half of the app. At return you enter how many came back, how many were damaged and how many were lost. Damage defaults to a percentage of the item's replacement value that you pick, loss defaults to the full replacement value, and late days are counted from the agreed return date. All of it is charged against the deposit, and whatever is left is refunded — or, if the charges ate the deposit, shown as a balance to collect.",
  },
  {
    question: "Do I need internet?",
    answer:
      "Only to open the page the first time. After that everything works with the internet down — which is most godowns, and most venues. Sharing a link and Google Sheet sync are the only parts that need a connection.",
  },
  {
    question: "Can I track individual cameras or tools by serial number?",
    answer:
      "Yes. Mark an item as serialised and add its serial numbers, and dispatch asks you to tick the exact units going out. A unit can be on only one live booking at a time and the app enforces it. Bulk items — chairs, plates, poles — stay counted, because no tent house wants to track chair number 147.",
  },
  {
    question: "How do I send a booking to a customer?",
    answer:
      "Every booking has a Send sheet with your own message templates and a link. The whole document travels inside the link, so nothing is uploaded and it opens on a phone with no signal. If you would rather have a short link, turn on automatic shortening in Settings — then a copy is stored so the link can stay short, and the app tells you that is what happened.",
  },
  {
    question: "Can two people use it at once, on different devices?",
    answer:
      "Not in the free app. Everything lives in one browser's storage with no account, so a phone in the yard and the office laptop cannot share a book. Keeping several devices in step needs a server between them, which is the one thing an app that works offline and asks for no login cannot do. Take a backup and carry it, or use the Google Sheet push for a read-only copy.",
  },
  {
    question: "Is my customers' data safe?",
    answer:
      "It never leaves the device. Names, phone numbers and ID proofs are stored in that browser only. Google Sheet sync, link sharing and backups are off or manual until you use them, and they go to your own sheet, your own customer and your own file.",
  },
];

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Setu Free Rental & Hire Book",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web browser",
  description:
    "Free rental management software for tent houses, event and equipment hire. Date-range availability, booking pipeline, dispatch challans, damage and late-fee settlement against deposits, and utilisation reports. Works offline in the browser with no signup.",
  featureList: [
    "Availability calendar across any date range, on the tightest day",
    "Over-commit conflict detection with a deliberate override",
    "Enquiry, confirmation, dispatch and return pipeline",
    "Picking lists, delivery challans and signature capture",
    "Damage, shortage and late-fee settlement against deposits",
    "Serialised unit tracking for cameras and tools",
    "Maintenance logs that remove stock from availability",
    "Utilisation and return-on-cost reports per item",
    "CSV export, JSON backup and Google Sheet sync",
    "Works offline, no login required",
  ],
  offers: freeOffer({ url: "/products/free-rental-software" }),
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

export default function FreeRentalSoftwarePage() {
  if (!rentalSoftwareEnabled()) notFound();

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
              <span className="text-sm font-semibold text-indigo">Free Tool — Works Offline</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              Free Rental &amp; Hire Book
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
              Never promise the same 200 chairs to two weddings. See exactly what is free on any
              date, and settle damage, shortage and late fees against the deposit when it all
              comes back.
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
        <RentalApp />
      </section>

      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                The availability engine
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                The one question every other free tool cannot answer
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Rental software everywhere models a hire as an invoice with two dates on it. That
                tells you what you sold. It does not tell you what you can still promise — which
                is the only thing anyone rings you to ask.
              </p>
            </div>
          </FadeIn>
          <FeatureCards items={AVAILABILITY} />
        </div>
      </section>

      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                Out and back
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                From the first phone call to the deposit refund
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Every booking moves through the same five states, and each screen shows only what
                that booking needs next.
              </p>
            </div>
          </FadeIn>
          <FeatureCards items={PIPELINE} />
        </div>
      </section>

      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                Around the book
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                Paper, messages and the numbers behind the season
              </h2>
            </div>
          </FadeIn>
          <FeatureCards items={AFTER} />
        </div>
      </section>

      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-4xl px-6">
          <FadeIn>
            <h2 className="text-center text-3xl font-bold tracking-tight text-ink">
              Anything that goes out and has to come back
            </h2>
            <ul className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
              {WHO.map((who) => (
                <li
                  key={who}
                  className="flex items-center gap-3 rounded-xl border border-muted-line/20 bg-cream-paper px-4 py-3"
                >
                  <Tent className="h-4 w-4 shrink-0 text-indigo" aria-hidden="true" />
                  <span className="text-sm font-semibold text-ink">{who}</span>
                </li>
              ))}
            </ul>
          </FadeIn>
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
                Everything runs in one browser with no account, so the hire book lives on one
                device. Two godowns cannot share it, a driver&apos;s phone cannot mark a delivery
                done from the venue, and a customer cannot check availability on your website
                before ringing you. All three need a server keeping several devices in step — the
                one thing an app that works offline and asks for no login cannot do. Everything on
                this page is free, and stays free.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/tools/invoice-generator"
                  className="inline-block rounded-full bg-indigo px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Need a plain invoice? →
                </Link>
                <Link
                  href="/tools/quotation-generator"
                  className="inline-block rounded-full border border-muted-line/30 px-6 py-2.5 text-sm font-semibold text-ink transition hover:border-indigo/40 hover:text-indigo"
                >
                  Just quoting for a job?
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

      <Faq headline="Free rental software — questions" items={FAQ_ITEMS} />
    </>
  );
}
