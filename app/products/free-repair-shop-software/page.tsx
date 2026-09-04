import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { repairSoftwareEnabled } from "@/lib/featureFlags";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  BarChart3,
  Camera,
  Link2,
  ClipboardList,
  FileSignature,
  Lock,
  MessageCircle,
  PackageX,
  Percent,
  Printer,
  Repeat,
  Search,
  ShieldCheck,
  Timer,
  TrendingUp,
  WifiOff,
  Wrench,
} from "lucide-react";
import { RepairApp } from "@/components/tools/Repair/RepairApp";
import { Faq } from "@/components/Faq";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";
import { freeOffer } from "@/lib/schema";

/**
 * Metadata is generated rather than exported flat, because a flat export is
 * evaluated even when the component below calls notFound(). The rendered <head>
 * was already correct, but the RSC payload embedded in the 404 still carried
 * this page's title, description and OG tags — view-source on a page that does
 * not exist yet was showing an unreleased product's marketing copy.
 */
export function generateMetadata(): Metadata {
  if (!repairSoftwareEnabled()) return {};
  return {
    title: "Free Repair Shop Software with Job Cards",
    description:
      "Free job card software for mobile and laptop repair shops. Record the device's condition with photos at intake, track every repair, and print the job slip.",
    keywords: [
      "mobile repair shop software free",
      "job card software free download",
      "computer service centre software",
      "repair shop management software India",
      "service job card format",
      "mobile shop billing software with job card",
      "laptop repair shop software",
      "free service centre software",
      "device repair tracking software",
    ],
    alternates: {
      canonical: "/products/free-repair-shop-software",
    },
    openGraph: {
      title: "Free Repair Job Card",
      description:
        "Photograph the device as it arrives, track every repair on one board, and prove what condition it came in. Works offline, no signup.",
      url: "/products/free-repair-shop-software",
      type: "website",
      images: [
        {
          url: "/og/setu-og-image-1200x627.png",
          width: 1200,
          height: 627,
          alt: "Setu Free Repair Job Card",
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
  { icon: Camera, label: "Photos at intake" },
  { icon: ClipboardList, label: "Job board" },
  { icon: WifiOff, label: "Works offline" },
  { icon: Lock, label: "No signup" },
  { icon: ShieldCheck, label: "Nothing leaves your device" },
];

const INTAKE: Feature[] = [
  {
    icon: Camera,
    title: "“That scratch wasn't there before”",
    description:
      "Every repair shop has had this argument, and without a record it is unwinnable. Intake takes photographs of the device as it arrives, timestamped, alongside a ticked checklist of the damage already on it. Four photos is usually two more than you need to end the conversation.",
  },
  {
    icon: ClipboardList,
    title: "A checklist per trade, not a blank box",
    description:
      "Screen cracked, back panel damaged, already opened before, liquid marks inside — mobile and laptop lists come ready to tick, and you can write your own for any other kind of device. A list is checked in seconds; an empty notes field gets skipped when there is a queue.",
  },
  {
    icon: FileSignature,
    title: "The customer signs for what you wrote down",
    description:
      "A signature on the screen, or on the printed slip if your customers would rather use a pen — the slip carries the same condition record either way, both halves of it: what was damaged and what was checked and found sound.",
  },
  {
    icon: Lock,
    title: "The record cannot be edited afterwards",
    description:
      "Once a job is saved, the checklist, the photos and the signature are locked. Anything found later goes in the notes with its own date. A record that can be revised after the argument starts is not a record, and this is the whole reason the app exists.",
  },
];

const BOARD: Feature[] = [
  {
    icon: Timer,
    title: "Cards go amber, then red",
    description:
      "Every job shows how many days the device has been in your shop, and the card changes colour as that number grows past your thresholds. A shop full of red cards is a shop with a problem, and you can see it from the doorway without reading a word.",
  },
  {
    icon: Search,
    title: "Search by IMEI, because that is what they read out",
    description:
      "A customer rings and reads a serial number off a box. Search matches part of it as readily as all of it — along with job numbers, phone numbers and names — because nobody gets fifteen digits right the first time.",
  },
  {
    icon: MessageCircle,
    title: "A WhatsApp message at every stage",
    description:
      "Move a card and the matching message is offered, already written: received, estimate, in repair, waiting for a part, ready. You tap send in WhatsApp — nothing goes out on its own — and the job's timeline records whether the customer was actually told.",
  },
  {
    icon: Link2,
    title: "One tracking link that never goes stale",
    description:
      "Optional, and off until you switch it on. Each job gets a web address you send once; every status change rewrites what it says, so the customer bookmarks one link instead of ringing. They can approve or decline an estimate from the same page, and the answer comes back into your board.",
  },
  {
    icon: Printer,
    title: "A slip for the customer and a tag for the device",
    description:
      "The job slip prints at A5 or on a 58mm roll with the full condition record on it. The device tag prints the job number large enough to read across a bench of identical black phones, with the customer's name and number underneath.",
  },
];

const MONEY: Feature[] = [
  {
    icon: PackageX,
    title: "The devices nobody came back for",
    description:
      "Repair shops accumulate finished work that customers never collect, and it is invisible until somebody adds it up. This lists them with a rupee total, and chases each customer on a cycle you set. It is usually the first thing this app pays for.",
  },
  {
    icon: Percent,
    title: "Margin, not turnover",
    description:
      "A shop can bill two lakh a month and keep almost none of it, because the screen it charged ₹4,000 for cost ₹3,400. Every part carries its cost price beside its selling price, so the margin is visible while the technician can still do something about it.",
  },
  {
    icon: Repeat,
    title: "Which supplier's parts keep coming back",
    description:
      "The same serial number returning inside ninety days, and warranty claims counted by model. Most owners have a vague feeling that a particular screen is trouble; this turns it into two rows against one model, which is a conversation with the supplier.",
  },
  {
    icon: ShieldCheck,
    title: "Warranty you can check in fifteen seconds",
    description:
      "Somebody walks in holding a phone saying you fixed it last month. Type the job number, the IMEI or their phone and get a plain yes or no with a date — and if it is covered, take it back in under warranty from the same screen, without it counting as new revenue.",
  },
  {
    icon: TrendingUp,
    title: "Turnaround, by technician and by device",
    description:
      "Average days from received to delivered, split by who did the work and what kind of device it was. Plus how many of your estimates were approved, which is the number that tells you whether you are quoting right.",
  },
  {
    icon: BarChart3,
    title: "Everything exports",
    description:
      "Jobs, parts used, stock, bills and the uncollected list all come out as CSV. There is a one-way Google Sheet push too — with photos, signatures and unlock codes deliberately left out of it, because a spreadsheet gets shared.",
  },
];

const WHO = [
  "Mobile phone repair shops",
  "Laptop and computer service centres",
  "Home appliance technicians",
  "Two-wheeler mechanics",
  "Watch and camera repair",
  "One to six technicians",
];

const FAQ_ITEMS = [
  {
    question: "Is this repair shop software really free?",
    answer:
      "Yes. No signup, no trial, and no limit on jobs, customers, parts or invoices. Everything runs inside your browser, so there is no server for us to charge you for.",
  },
  {
    question: "What does the condition record actually do for me?",
    answer:
      "It ends the argument. When a customer says a scratch or a crack was not there before, you have a timestamped checklist of what the device looked like when it arrived, photographs of it, and their signature against that record — printed on the slip they walked out with. The checklist prints both halves: the damage that was there, and the things that were checked and found sound. Nothing on that record can be edited after the job is saved.",
  },
  {
    question: "Can I take photos on a phone?",
    answer:
      "Yes, that is the expected way to use it. Tapping Add photo opens the camera directly. Each photo is shrunk to a sensible size before it is stored, so a year of jobs still fits in the browser and still fits in a backup.",
  },
  {
    question: "Does it store the customer's unlock code?",
    answer:
      "Only if you turn that on, and it is off to begin with. Technicians genuinely need it to test a repair, but it is also the single most sensitive thing this app could hold — it is stored in plain text in your browser, and anyone who can open the app can read it. The app says so where you switch it on and again where you type it. Plenty of shops are better off keeping codes on paper and shredding them at the end of the day.",
  },
  {
    question: "How does the uncollected list work?",
    answer:
      "Any device marked ready and not picked up within your chosen number of days appears on it, with a total value of everything sitting there. From the same place you can send each customer a reminder on WhatsApp, and the job's timeline records that they were chased so the next reminder is due an interval later.",
  },
  {
    question: "Does the customer get a link to track their repair?",
    answer:
      "Yes, if you switch it on. Turn on customer tracking links in Settings and every job gets a web address you can send with the first WhatsApp. The address never changes — each status change rewrites what it says — so the customer can bookmark it and always see where their device is, what was promised and what it will cost. It is off by default, because it is the only part of this app that sends anything off your device.",
  },
  {
    question: "Can the customer approve an estimate from that link?",
    answer:
      "Yes. When you send an estimate you can turn on Approve and Decline on their page, and their answer comes back into your job card — approving moves the job to Approved and records the date, declining marks it returned unrepaired. It is not instant: the app checks for an answer while the job is open on your screen, so it lands within a minute of you looking rather than the moment they tap. A WhatsApp reply still cannot reach the app; the link is what makes an answer readable at all.",
  },
  {
    question: "What exactly gets uploaded when tracking is on?",
    answer:
      "The shop name, job number, device, current status, the promised date and the amount — enough for the page to answer the question the customer opened it to ask. The intake photos, the signature, the unlock code, your diagnosis, your parts and their prices and the customer's address are never sent. Anyone holding the link can see that one job and answer its estimate, so treat the link like the message you sent it in. Leave the setting off and nothing leaves your device at all.",
  },
  {
    question: "Does it handle parts stock and billing?",
    answer:
      "Yes, at the scale a repair shop needs. Parts carry a cost price, a selling price, a stock count and a low-stock warning; fitting one to a job takes it off the shelf, and changing your mind puts it back. Delivery raises an invoice with the parts, the labour, any tax you have switched on, and the warranty expiry printed on it.",
  },
  {
    question: "Do I need internet?",
    answer:
      "Only to open the page the first time. After that the workbench works with the connection down, which is the point. WhatsApp messages and the Google Sheet push are the only parts that need one.",
  },
  {
    question: "Can two people use it at once?",
    answer:
      "Not in the free app. Everything lives in one browser's storage with no account, so the counter tablet and the workbench laptop cannot share a board. Keeping several devices in step needs a server between them, which is the one thing an app that works offline and asks for no login cannot do.",
  },
  {
    question: "Where is my data, and can I get it out?",
    answer:
      "In that browser, on that device, and nowhere else unless you send it. Download a full JSON backup whenever you like — including or excluding the photos, since photos are most of the size — and restore it on another machine. Every list also exports as CSV.",
  },
];

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Setu Free Repair Job Card",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web browser",
  description:
    "Free repair shop and job card software for Indian mobile, laptop and appliance repair businesses. Records the device's condition with photos and a signature at intake, tracks every repair on an ageing board, sends WhatsApp updates, optionally gives each customer a tracking link they can approve an estimate from, bills parts and labour, and reports margin, turnaround and repeat failures. Works offline in the browser with no signup.",
  featureList: [
    "Intake condition checklist with camera photos and a customer signature",
    "An intake record that cannot be edited after the job is saved",
    "Job board with ageing colours, filters and IMEI search",
    "WhatsApp status updates from your own message templates",
    "An optional constant tracking link per job, with estimate approval from the page",
    "Job slip, device tag, estimate and invoice printing",
    "Parts stock with cost and selling prices, and low-stock warnings",
    "Delivery with payment, signature and a printed warranty expiry",
    "Warranty lookup by job number, IMEI or phone, and warranty claims",
    "Uncollected device list with a value total and a reminder cycle",
    "Margin, turnaround, technician and repeat-failure reports",
    "CSV export, JSON backup and Google Sheet sync",
    "Works offline, no login required",
  ],
  offers: freeOffer({ url: "/products/free-repair-shop-software" }),
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

export default function FreeRepairShopSoftwarePage() {
  if (!repairSoftwareEnabled()) notFound();

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
              Free Repair Shop Software with Job Cards
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
              Know where every device in your shop is, and prove what condition it arrived in. A job
              card for mobile, laptop and appliance repair that takes ninety seconds to fill in.
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
        <RepairApp />
      </section>

      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                The intake record
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                Evidence, taken before the device goes in the drawer
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Nothing else on this page matters as much as this. Thirty seconds at the counter,
                and the argument three days later is over before it starts.
              </p>
            </div>
          </FadeIn>
          <FeatureCards items={INTAKE} />
        </div>
      </section>

      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                The board
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                Every device in the shop, on one screen
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Received, diagnosing, waiting for a part, ready. Where each device is, who is on it,
                and how long it has been sitting there.
              </p>
            </div>
          </FadeIn>
          <FeatureCards items={BOARD} />
        </div>
      </section>

      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                The money
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                The numbers that tell you whether the shop works
              </h2>
            </div>
          </FadeIn>
          <FeatureCards items={MONEY} />
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
                  <Wrench className="h-4 w-4 shrink-0 text-indigo" aria-hidden="true" />
                  <span className="text-sm font-semibold text-ink">{who}</span>
                </li>
              ))}
            </ul>
          </FadeIn>
        </div>
      </section>

      {/*
        The limits section. A free app that promises to settle disputes has to be
        plain about what it does not do, in the same voice as everything else
        rather than in a box of small print.
      */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-4xl px-6">
          <FadeIn>
            <div className="rounded-2xl border border-muted-line/20 bg-white p-8">
              <h2 className="text-2xl font-bold tracking-tight text-ink">
                Where the free tool stops
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                The intake record is your own record, kept on your own device. It is strong evidence
                in a conversation with a customer; it is not a legal document, and nothing here is
                advice about the terms you put on your job slip. The photographs and the signature
                are only as good as the thirty seconds somebody spends taking them.
              </p>
              <p className="mt-4 leading-relaxed text-muted">
                Everything runs in one browser with no account, so the shop lives on one device
                and a second machine cannot share the same board — that needs a server between
                them. WhatsApp messages are prepared for you to send, never sent automatically, and
                a reply to one still cannot reach the app. Customer tracking links are the single
                exception to the offline rule, and they are off until you turn them on: while they
                are on, each job&apos;s status and amount are stored so the customer&apos;s page can
                read them, an answer to an estimate arrives when you next look rather than the
                instant it is given, and a link eventually expires. Everything on this page is free,
                and stays free.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/products/browser-based-pos"
                  className="inline-block rounded-full bg-indigo px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Also sell accessories? Try the retail POS →
                </Link>
                <Link
                  href="/tools/label-printer"
                  className="inline-block rounded-full border border-muted-line/30 px-6 py-2.5 text-sm font-semibold text-ink transition hover:border-indigo/40 hover:text-indigo"
                >
                  Print device tags
                </Link>
                <Link
                  href="/tools/invoice-generator"
                  className="inline-block rounded-full border border-muted-line/30 px-6 py-2.5 text-sm font-semibold text-ink transition hover:border-indigo/40 hover:text-indigo"
                >
                  Invoice generator
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <Faq headline="Free repair shop software — questions" items={FAQ_ITEMS} />
    </>
  );
}
