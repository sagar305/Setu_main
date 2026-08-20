import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  BarChart3,
  Bell,
  Clock,
  Download,
  Languages,
  ListOrdered,
  Lock,
  MessageCircle,
  Monitor,
  Printer,
  QrCode,
  Repeat,
  Sheet,
  ShieldCheck,
  SkipForward,
  Star,
  Ticket,
  Timer,
  TrendingUp,
  Users,
  Volume2,
  WifiOff,
} from "lucide-react";
import { TokenApp } from "@/components/tools/Token/TokenApp";
import { Faq } from "@/components/Faq";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";
import { freeOffer } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Free Token System for Clinics, Labs & Shops",
  description:
    "Free token system for clinics, labs, salons and shops. Calls each number out loud in Hindi or English, shows it on a TV, works offline with no signup.",
  keywords: [
    "token system software free",
    "queue management system free download",
    "token display software for clinic",
    "free token number display",
    "customer queue app",
    "token calling system",
    "token system for clinic India",
    "queue display software for TV",
    "free token generator for shop",
  ],
  alternates: {
    canonical: "/products/free-token-system",
  },
  openGraph: {
    title: "Free Token System",
    description:
      "Hand out tokens, put a screen in the waiting area, and let the app call each number out loud. Free, offline, no signup.",
    url: "/products/free-token-system",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Free Token System",
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
  { icon: Volume2, label: "Calls numbers out loud" },
  { icon: WifiOff, label: "Works offline" },
  { icon: Lock, label: "No signup" },
  { icon: Monitor, label: "Runs on any TV" },
  { icon: ShieldCheck, label: "Nothing leaves your device" },
];

const CALLING: Feature[] = [
  {
    icon: Volume2,
    title: "It says the number out loud",
    description:
      "“Token A forty-two, please proceed to Counter three.” Not a beep — the actual sentence, spoken by the browser. Every commercial token system charges for this and needs a server; here it is a tab that is already open.",
  },
  {
    icon: Languages,
    title: "In the language your customers speak",
    description:
      "Hindi, English, Marathi, Tamil, Telugu, Bengali, Gujarati and Kannada, plus whatever else the device has. Edit the sentence itself if you want different words, and test it before you trust a waiting room to it.",
  },
  {
    icon: Monitor,
    title: "A display screen for the waiting area",
    description:
      "Open one page on a TV or a spare monitor and leave it. The number fills the screen, the last three calls sit underneath, and it follows the counter with nobody touching it.",
  },
  {
    icon: Bell,
    title: "A chime, and a flash if all else fails",
    description:
      "Old smart TV browsers have no speech engine and sometimes no sound at all. The screen flashes on every call regardless, so the room always knows something changed.",
  },
];

const COUNTER: Feature[] = [
  {
    icon: Ticket,
    title: "One tap to give a token",
    description:
      "Pick the line, take the customer's name and number, and the token comes up huge for two seconds while you hand over the slip. Every token belongs to someone you can reach.",
  },
  {
    icon: Timer,
    title: "An honest wait estimate",
    description:
      "How many are ahead, how long each one takes, across however many counters are open — rounded to five minutes and shown as “about 20 min”, never as a promise it cannot keep.",
  },
  {
    icon: Star,
    title: "Priority for those who need it",
    description:
      "Senior citizens, emergencies and appointment holders jump the waiting line. Anyone already at a counter is never re-ordered under the person standing in front of them.",
  },
  {
    icon: SkipForward,
    title: "A two-minute clock, then the queue moves on",
    description:
      "A called token counts down. One tap messages them that the clock is running; when it runs out the token skips itself, so the whole line is not held up by the person who wandered off. Call again at any time and the clock restarts.",
  },
  {
    icon: Repeat,
    title: "Move someone to the right desk",
    description:
      "Transfer a token to another service or another counter. The number goes with them — the person holding the slip has been told to watch for that number.",
  },
  {
    icon: Users,
    title: "Several counters, one queue",
    description:
      "Each tablet or PC remembers which desk it is. Every one of them calls from the same line, and the display shows whichever was called last.",
  },
];

const AFTER: Feature[] = [
  {
    icon: Printer,
    title: "Token slips on a 58mm printer",
    description:
      "The number, the line, the estimated wait and the time — printed the size of a receipt on the thermal printer you already own.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp at every step",
    description:
      "The number when it is issued, a nudge when their turn is near, a warning when they have been called, and a note if they were skipped. The app writes each one and you tap send — nothing goes out on its own, because an app with no server cannot honestly claim to.",
  },
  {
    icon: QrCode,
    title: "A poster for the waiting area",
    description:
      "Print an A4 sheet with a QR code that tells a customer what to do next. Straightforward about what it is: they still collect the number from you.",
  },
  {
    icon: BarChart3,
    title: "Reports that answer one question",
    description:
      "When does the room fill? The by-hour row tells you whether a second person at 11am pays for itself. Plus no-show rates, average wait, and who served how many.",
  },
  {
    icon: Sheet,
    title: "Google Sheet backup",
    description:
      "Push the day's tokens to your own sheet. One way only — a spreadsheet is never allowed to write back over a live queue.",
  },
  {
    icon: Download,
    title: "Your data, in a file",
    description:
      "CSV of every token, and a JSON backup you can carry to another device. Ninety days are kept on the device; export before that if you need longer.",
  },
];

const WHO = [
  "Clinics and diagnostic labs",
  "Salons and barbers",
  "Bank branches and cooperative societies",
  "Government offices and RTO agents",
  "Service centres and mobile shops",
  "Canteens and small restaurants",
];

const FAQ_ITEMS = [
  {
    question: "Is this token system really free?",
    answer:
      "Yes. There is no signup, no trial and no limit on how many tokens you issue. Everything runs inside your browser, so there is no server for us to charge you for.",
  },
  {
    question: "Do I need internet for it to work?",
    answer:
      "Only to open the page the first time. After that the queue, the display and the announcements all work with the internet down — which is exactly when a waiting room gets difficult.",
  },
  {
    question: "How does the display screen stay in step with the counter?",
    answer:
      "Both are tabs on the same device reading one database. When the counter calls a token, the display re-reads it and repaints — usually instantly, and at worst within a couple of seconds, because it also checks on its own in case the browser dropped the message.",
  },
  {
    question: "Can I run the counter on a phone and the display on a TV?",
    answer:
      "Not in the free app. Two devices cannot share one browser's storage, so both surfaces have to be tabs on the same machine — a counter PC with a second monitor, or a laptop plugged into a TV. Keeping separate devices in step needs a server between them, which is the one thing an app with no account and no internet cannot do.",
  },
  {
    question: "Which languages can it announce in?",
    answer:
      "Hindi, English (India), Marathi, Tamil, Telugu, Bengali, Gujarati and Kannada are the ones we test. The picker also lists every voice your own device has. If a language is missing, the app tells you which voice it will use instead rather than failing quietly.",
  },
  {
    question: "What happens if someone does not come when their number is called?",
    answer:
      "A called token counts down — two minutes by default, and you can change it or switch it off. There is a WhatsApp button to tell them the clock is running. If it runs out the token is skipped automatically so the queue keeps moving, and you can message them to say so. When they turn up, one tap gives them a fresh number behind everyone currently waiting; they do not get the old number back, because it has already been called out to the room.",
  },
  {
    question: "What happens to the numbering at the end of the day?",
    answer:
      "Tokens restart at 1 at an hour you choose. Set it before you open, and a clinic still seeing patients at 1am keeps one logical day. There is also a Reset now button for the day that does not end when the clock says it does.",
  },
  {
    question: "Can a customer scan a QR code and get their own token?",
    answer:
      "The free app prints a poster whose QR opens a page telling them to show it at the counter — they still collect the number from you. A customer's own phone taking a number and watching its position move would need a server both devices share, so it is not something an offline app can do honestly.",
  },
  {
    question: "Is my customers' data safe?",
    answer:
      "It never leaves the device. Names and phone numbers, if you take them, are stored in that browser only. Google Sheet sync and backups are off until you switch them on, and they go to your own sheet and your own file.",
  },
];

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Setu Free Token System",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web browser",
  description:
    "Free token and queue management system with voice announcements, a waiting-room display screen, token slips and reports. Works offline in the browser with no signup.",
  featureList: [
    "Voice announcements in Hindi, English and regional languages",
    "Waiting-room display screen for a TV or second monitor",
    "Multiple services and counters with priority tokens",
    "Recall, skip and transfer",
    "Wait estimates and 58mm token slips",
    "Hourly load, no-show and counter reports",
    "CSV export, JSON backup and Google Sheet sync",
    "Works offline, no login required",
  ],
  offers: freeOffer({ url: "/products/free-token-system" }),
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

export default function FreeTokenSystemPage() {
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
              Free Token System
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
              Stop shouting names across the waiting room. Hand out numbers, put a screen on the
              wall, and let the app call each person out loud — in Hindi, English or your
              language.
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
        <TokenApp />
      </section>

      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                The announcement
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                The part everyone else charges for
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                A token system is only useful if the room hears it. Your browser has been able to
                speak since 2014 — nobody thought to point it at a waiting room.
              </p>
            </div>
          </FadeIn>
          <FeatureCards items={CALLING} />
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
                Built for one thumb, standing up
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Whoever runs the counter is also talking to a customer. Call next is one
                full-width button, and everything else is one tap from it.
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
                Around the queue
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                Slips, messages and the numbers behind the day
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
              Anywhere people wait in a line
            </h2>
            <ul className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
              {WHO.map((who) => (
                <li
                  key={who}
                  className="flex items-center gap-3 rounded-xl border border-muted-line/20 bg-cream-paper px-4 py-3"
                >
                  <ListOrdered className="h-4 w-4 shrink-0 text-indigo" aria-hidden="true" />
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
                Everything runs in one browser with no account, so the counter and the display have
                to be two tabs on the same machine. A receptionist&apos;s phone and a TV across the
                room cannot share a queue, and a customer&apos;s own phone cannot take a number and
                watch its position move. Both of those need a server keeping several devices in
                step — the one thing an app that works offline and asks for no login cannot do.
                Everything on this page is free, and stays free.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/products/free-clinic-software"
                  className="inline-block rounded-full bg-indigo px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Running a clinic? →
                </Link>
                <Link
                  href="/tools/appointment-book"
                  className="inline-block rounded-full border border-muted-line/30 px-6 py-2.5 text-sm font-semibold text-ink transition hover:border-indigo/40 hover:text-indigo"
                >
                  Need appointments instead?
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

      <Faq headline="Free token system — questions" items={FAQ_ITEMS} />
    </>
  );
}
