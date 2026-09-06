import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pharmacySoftwareEnabled } from "@/lib/featureFlags";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ClipboardList,
  Download,
  FileText,
  Layers,
  Lock,
  MessageCircle,
  Percent,
  Pill,
  Printer,
  RotateCcw,
  ScanLine,
  Search,
  Share2,
  Sheet,
  ShieldCheck,
  Stethoscope,
  Truck,
  Wallet,
  WifiOff,
} from "lucide-react";
import { PharmacyApp } from "@/components/tools/Pharmacy/PharmacyApp";
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
  if (!pharmacySoftwareEnabled()) return {};
  return {
    title: "Free Pharmacy Software for Medical Stores with Expiry",
    description:
      "Free pharmacy billing software for Indian medical stores. Batch-wise stock, oldest-expiry-first billing, and a dashboard of what to return before it expires.",
    keywords: [
      "pharmacy software free download",
      "medical store billing software free",
      "chemist shop software India",
      "pharmacy billing software with expiry",
      "medical store inventory software",
      "batch wise pharmacy software",
      "free medical store software",
      "pharmacy software with schedule H register",
      "drug store billing software India",
    ],
    alternates: {
      canonical: "/products/free-pharmacy-software",
    },
    openGraph: {
      title: "Free Pharmacy POS",
      description:
        "Batch-wise stock, oldest-expiry-first billing, and an expiry dashboard worth real money every month. Works offline, no signup.",
      url: "/products/free-pharmacy-software",
      type: "website",
      images: [
        {
          url: "/og/setu-og-image-1200x627.png",
          width: 1200,
          height: 627,
          alt: "Setu Free Pharmacy POS",
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
  { icon: CalendarClock, label: "Expiry dashboard" },
  { icon: Layers, label: "Batch-wise stock" },
  { icon: WifiOff, label: "Works offline" },
  { icon: Lock, label: "No signup" },
  { icon: ShieldCheck, label: "Nothing leaves your device" },
];

const EXPIRY: Feature[] = [
  {
    icon: CalendarClock,
    title: "₹18,400 expires in 60 days — here is the list",
    description:
      "Stock bucketed into 30, 60 and 90 days and already expired, each bucket showing what it cost you rather than how many batches it is. A batch count is a statistic. A rupee figure is a reason to ring the distributor this afternoon.",
  },
  {
    icon: Truck,
    title: "Grouped by supplier, because that is who takes it back",
    description:
      "A distributor accepts back what they supplied and nothing else, so an expiry list sorted by date is a list nobody can act on. Sorted by supplier it is a stack of return notes, and each group ends in a button that creates one.",
  },
  {
    icon: ClipboardList,
    title: "A removal list in rack order",
    description:
      "Expired stock prints as a checklist sorted by shelf, not by date — because the person holding it is walking the shop pulling strips, and a list in shelf order is walked once instead of three times.",
  },
  {
    icon: AlertTriangle,
    title: "Expired stock can never be billed",
    description:
      "Whatever your settings say, a batch past its month cannot go on a bill. You can also refuse batches within a number of days of expiry, though most shops should leave that at zero — a strip expiring in three weeks is fine for a five-day course.",
  },
];

const COUNTER: Feature[] = [
  {
    icon: Layers,
    title: "Stock lives on the batch, never on the medicine",
    description:
      "You do not have forty Crocin. You have twelve of batch J4213 expiring in August and twenty-eight of K1180 expiring next February, bought at different rates. Every screen in this app is built on that difference, which is why it can do things a product-level POS cannot.",
  },
  {
    icon: Pill,
    title: "Oldest expiry first, automatically",
    description:
      "Adding a medicine picks the batch expiring soonest and puts its number and expiry on the line. Ask for twenty when the oldest batch has twelve left and it splits into two lines by itself — twelve off one, eight off the next — because that is what has to print on the bill.",
  },
  {
    icon: Search,
    title: "One box that searches brand, salt and barcode",
    description:
      "A doctor's chit says whatever it says. Type any of the three and it matches, and every result expands to show the same-salt alternatives you have in stock with their MRPs — the question the counter is asked twenty times a day.",
  },
  {
    icon: Stethoscope,
    title: "Prescriptions asked for at the end, not mid-sale",
    description:
      "A bill with a Schedule H, H1 or X line cannot be completed without the patient, the doctor and their registration number — but you are not interrupted the moment the strip is scanned. Which classes to enforce is yours to set.",
  },
  {
    icon: ScanLine,
    title: "Loose tablets, whole strips, and the rack it is on",
    description:
      "Stock is counted in units so a cut strip is not a problem, with a one-tap shortcut for a whole pack. Search results carry the rack number, which at a busy counter saves more time than anything else on this page.",
  },
  {
    icon: RotateCcw,
    title: "Held bills and returns that go back to the right batch",
    description:
      "Park a bill when someone goes back to the car for money. And a returned strip goes back to the exact batch it left on, expiry and all — so it turns up on the expiry screen rather than quietly rejoining general stock.",
  },
];

const BOOKS: Feature[] = [
  {
    icon: Truck,
    title: "Purchase entry that matches the paper",
    description:
      "Enter the distributor's invoice in packs, with the running total beside you to check against theirs before saving. Scheme goods are handled properly: ten paid and one free is eleven on the shelf at a blended cost, which is the number your margin should be measured against.",
  },
  {
    icon: Percent,
    title: "Margin off the batch that actually sold",
    description:
      "The same medicine bought on two invoices at two rates has two margins. Averaging them hides the one you are losing money on, so cost is read off the specific batch each line came from.",
  },
  {
    icon: FileText,
    title: "A schedule register you can print",
    description:
      "Every scheduled sale in a date range with the prescription details, printable and exportable. Bills where no prescription was captured appear with the doctor columns blank — a gap you can see rather than one the report hides.",
  },
  {
    icon: BarChart3,
    title: "The reports a shop actually runs on",
    description:
      "Sales by day and month, fast and slow movers, stock value at cost and at MRP, a suggested order list grouped by supplier, GST by rate, and supplier-wise outstanding. CSV on all of them.",
  },
  {
    icon: Wallet,
    title: "Udhaar, tracked per bill and per customer",
    description:
      "Part-paid bills leave a balance against the customer, and the balance reminder goes out on WhatsApp from your own template when you decide to send it.",
  },
  {
    icon: Share2,
    title: "Send the bill as a link, on WhatsApp",
    description:
      "The whole bill travels inside the link — batch numbers, expiry dates and all — so nothing is uploaded and it opens on a phone with no signal. Send it to the customer's own number, or show them the QR across the counter.",
  },
  {
    icon: Printer,
    title: "Bills, notes and lists on your own paper",
    description:
      "GST bill with batch, expiry, HSN and a CGST/SGST split, on 58mm, 80mm or A4. Purchase return notes and expiry removal lists print too.",
  },
];

const WHO = [
  "Independent medical stores",
  "Chemist shops with one to three counters",
  "Clinic pharmacies and dispensaries",
  "Generic and Jan Aushadhi outlets",
  "Ayurvedic and homeopathy stores",
  "Surgical and consumables counters",
];

const FAQ_ITEMS = [
  {
    question: "Is this pharmacy software really free?",
    answer:
      "Yes. No signup, no trial, and no limit on medicines, batches, bills or customers. Everything runs inside your browser, so there is no server for us to charge you for.",
  },
  {
    question: "What does batch-wise stock actually change?",
    answer:
      "Everything a pharmacy needs that a normal POS cannot do. Because stock sits on a batch rather than on a medicine, the app knows every expiry date in the shop, bills from the strip expiring first, prints the batch number on the bill, sends returns back to the batch they came from, and reports margin against what that specific batch cost. A product-level POS knows only that you have forty of something.",
  },
  {
    question: "How does the expiry dashboard save money?",
    answer:
      "Expired stock is a total loss, and most shops find out months after the distributor would still have taken it back. The dashboard shows what expires in the next 30, 60 and 90 days and what it cost you, grouped by the supplier who has to accept it, with a button that creates the return note. Checking it once a week is the whole discipline.",
  },
  {
    question: "Does it handle Schedule H and H1?",
    answer:
      "It records them. Mark a medicine's schedule and a bill containing it cannot be completed without the patient name, the doctor's name and their registration number, with an optional photo of the prescription. Those sales can then be printed as a date-ranged register. Read the next answer before you rely on it.",
  },
  {
    question: "Is the register compliance-ready?",
    answer:
      "No, and it does not claim to be. It is a record built from your own bills for your own use, and it says so on the printed page. It does not replace any register you are required to maintain under the Drugs and Cosmetics Rules, it does not verify a prescription or a registration number, and it does not decide whether a sale is lawful. That judgement stays with your registered pharmacist. Check the output against what your drug inspector expects before you depend on it.",
  },
  {
    question: "How compliant is the printed bill?",
    answer:
      "It is a simple GST bill: batch number and expiry on every line, HSN and tax rate, a CGST and SGST split, your GSTIN and drug licence in the header, and the amount in words. It does not produce a full statutory tax invoice — there is no place of supply, no HSN-wise summary table, no reverse-charge line and no IGST for inter-state supply.",
  },
  {
    question: "Do I have to type my whole medicine list in?",
    answer:
      "No. There is a CSV importer that takes a pasted spreadsheet block as readily as a file, and it understands the column names distributor price lists and other billing software actually use — salt, generic, content, packing, MFR and so on. We deliberately do not ship a drug dataset: an error in a price list is an annoyance, and an error in a drug list is not.",
  },
  {
    question: "Can I send a bill to a customer on WhatsApp?",
    answer:
      "Yes. Every bill has a Share link button, straight after the sale and again later from the customer's ledger. The whole bill — including batch numbers and expiry dates — is compressed into the link itself, so nothing is uploaded and it opens on a phone with no signal. It goes to the customer's own number when you have it, and there is a QR of the link to show across the counter.",
  },
  {
    question: "Do I need internet?",
    answer:
      "Only to open the page the first time. After that the counter works with the connection down, which is the point. Google Sheet sync and WhatsApp messages are the only parts that need one.",
  },
  {
    question: "Can two counters share the same stock?",
    answer:
      "Not in the free app. Everything lives in one browser's storage with no account, so two machines cannot share a shelf — and with batch-level stock, two machines disagreeing about a batch is worse than useless. Keeping several devices in step needs a server between them, which is the one thing an app that works offline and asks for no login cannot do.",
  },
  {
    question: "Is my patients' data safe?",
    answer:
      "It never leaves the device unless you send it. Patient names, doctor details and any prescription photos are stored in that browser only. Google Sheet sync is off until you set it up, and if you turn it on, note that the register tab carries patient and doctor names — the app says so where you switch it on.",
  },
];

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Setu Free Pharmacy POS",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web browser",
  description:
    "Free pharmacy billing and inventory software for Indian medical stores. Batch-wise stock with expiry tracking, FEFO billing, distributor purchase entry with scheme goods, an expiry dashboard grouped by supplier, prescription capture for scheduled medicines, and margin and GST reports. Works offline in the browser with no signup.",
  featureList: [
    "Batch-level stock with month-precision expiry",
    "FEFO billing that splits a quantity across batches automatically",
    "Expiry dashboard bucketed by days and grouped by supplier",
    "One-tap purchase return notes for expired and damaged stock",
    "Search across brand name, salt and barcode with substitute suggestions",
    "Prescription capture and a printable scheduled-sales register",
    "Distributor purchase entry with scheme (free goods) costing",
    "Margin reporting against the batch each sale drew from",
    "Shareable bill links over WhatsApp, with nothing uploaded",
    "GST summary by rate, stock value, movers and reorder lists",
    "CSV export, JSON backup and Google Sheet sync",
    "Works offline, no login required",
  ],
  offers: freeOffer({ url: "/products/free-pharmacy-software" }),
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

export default function FreePharmacySoftwarePage() {
  if (!pharmacySoftwareEnabled()) notFound();

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
              Free Pharmacy Software for Medical Stores
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
              Sell from the right batch, and never be surprised by an expiry. Batch-wise billing
              for a chemist shop, with a dashboard that tells you what is about to die while the
              distributor will still take it back.
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
        <PharmacyApp />
      </section>

      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                The expiry dashboard
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                The money you are losing without knowing it
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Expired stock is not a small loss, it is a total one — and by the time most shops
                notice, the window to send it back has closed. This is the screen that pays for
                the app it comes in.
              </p>
            </div>
          </FadeIn>
          <FeatureCards items={EXPIRY} />
        </div>
      </section>

      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                At the counter
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                Built for how a chemist actually sells
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Loose tablets off a cut strip, a customer asking what else has the same salt, and
                a queue behind them. Every decision here is about the seconds that costs.
              </p>
            </div>
          </FadeIn>
          <FeatureCards items={COUNTER} />
        </div>
      </section>

      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                Behind the counter
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                Purchases, margin and the papers you have to keep
              </h2>
            </div>
          </FadeIn>
          <FeatureCards items={BOOKS} />
        </div>
      </section>

      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-4xl px-6">
          <FadeIn>
            <h2 className="text-center text-3xl font-bold tracking-tight text-ink">
              Who it is for
            </h2>
            <ul className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
              {WHO.map((who) => (
                <li
                  key={who}
                  className="flex items-center gap-3 rounded-xl border border-muted-line/20 bg-cream-paper px-4 py-3"
                >
                  <Pill className="h-4 w-4 shrink-0 text-indigo" aria-hidden="true" />
                  <span className="text-sm font-semibold text-ink">{who}</span>
                </li>
              ))}
            </ul>
          </FadeIn>
        </div>
      </section>

      {/*
        The limits section, and the one on this site that matters most. A free
        app in regulated territory has to be plain about what it is not, in the
        same voice as everything else rather than in a box of small print.
      */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-4xl px-6">
          <FadeIn>
            <div className="rounded-2xl border border-muted-line/20 bg-white p-8">
              <h2 className="text-2xl font-bold tracking-tight text-ink">
                Where the free tool stops
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                This app keeps your shop&apos;s own records. It is not a compliance product: the
                scheduled-sales register it prints is built from your own bills for your own use,
                it does not replace any register you are required to maintain under the Drugs and
                Cosmetics Rules, and it does not verify a prescription, check a registration
                number or decide whether a sale is lawful. That judgement belongs to your
                registered pharmacist. The printed bill is a simple GST bill and not a full
                statutory tax invoice.
              </p>
              <p className="mt-4 leading-relaxed text-muted">
                Everything runs in one browser with no account, so the shop lives on one device.
                A second counter cannot share the same stock, and no drug dataset ships with the
                app — you import your own master. All three are consequences of an app that works
                offline and asks for no login. Everything on this page is free, and stays free.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/products/browser-based-pos"
                  className="inline-block rounded-full bg-indigo px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Not a pharmacy? Try the retail POS →
                </Link>
                <Link
                  href="/products/free-clinic-software"
                  className="inline-block rounded-full border border-muted-line/30 px-6 py-2.5 text-sm font-semibold text-ink transition hover:border-indigo/40 hover:text-indigo"
                >
                  Running a clinic too?
                </Link>
                <Link
                  href="/calculators/gst-calculator"
                  className="inline-block rounded-full border border-muted-line/30 px-6 py-2.5 text-sm font-semibold text-ink transition hover:border-indigo/40 hover:text-indigo"
                >
                  GST calculator
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <Faq headline="Free pharmacy software — questions" items={FAQ_ITEMS} />
    </>
  );
}
