import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  Activity,
  BadgeIndianRupee,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FlaskConical,
  HeartPulse,
  Layers,
  Lock,
  MessageCircle,
  Pill,
  Printer,
  Receipt,
  Search,
  Sheet,
  ShieldCheck,
  Stethoscope,
  Timer,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  WifiOff,
} from "lucide-react";
import { ClinicApp } from "@/components/tools/Clinic/ClinicApp";
import { Faq } from "@/components/Faq";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";
import { freeOffer } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Free Clinic Management & Prescription Software",
  description:
    "Free clinic software for prescriptions, patient records, appointments and billing. Works offline in your browser — no signup, no download, no patient limit.",
  keywords: [
    "free clinic management software",
    "clinic software free download India",
    "prescription writing software free",
    "doctor appointment software free",
    "patient record software for small clinic",
    "OPD management software free",
    "free software for dental clinic",
    "how to write prescription on computer",
    "clinic billing software free",
  ],
  alternates: {
    canonical: "/products/free-clinic-software",
  },
  openGraph: {
    title: "Free Clinic Management Software",
    description:
      "Prescriptions, patient records, appointments and billing — free, offline, no signup. Built for single-doctor and small clinics in India.",
    url: "/products/free-clinic-software",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Free Clinic Manager",
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
  { icon: Printer, label: "Prints real prescriptions" },
  { icon: Sheet, label: "Google Sheet sync" },
  { icon: ShieldCheck, label: "Records stay on your device" },
];

const CONSULT: Feature[] = [
  {
    icon: Pill,
    title: "A prescription pad that behaves like one",
    description:
      "Search a medicine by name or by salt, tap 1-0-1, type the days. The quantity to dispense works itself out. Type a medicine that is not in your list and it still prescribes — nothing blocks you mid-consultation.",
  },
  {
    icon: Layers,
    title: "Protocols — the reason doctors stay",
    description:
      "Save a whole prescription as “Viral fever – adult”, then load it in one tap on the next patient and edit what differs. After ten of these, a consultation is thirty seconds of typing.",
  },
  {
    icon: Printer,
    title: "Prints sharp, selectable text",
    description:
      "The prescription is printed as real text, not a screenshot, so it stays crisp on any printer and a pharmacist can select it on screen. A4 or A5, with the clinic header switched off when you print on your own letterhead pad.",
  },
  {
    icon: Activity,
    title: "Vitals, with BMI done for you",
    description:
      "BP, pulse, temperature, SpO₂, weight and height. BMI computes as you type, and every field shows that patient's last reading as a placeholder so change is visible at a glance.",
  },
  {
    icon: Search,
    title: "It gets faster the more you use it",
    description:
      "Complaints, findings, diagnosis and advice autocomplete from what you yourself have written before, ranked by how often. Your own vocabulary, not a generic dropdown.",
  },
  {
    icon: FlaskConical,
    title: "Investigation slips",
    description:
      "List the tests you want and print them as a separate A5 slip the patient carries to the lab, signed and dated like the prescription.",
  },
];

const DAY: Feature[] = [
  {
    icon: Timer,
    title: "One screen for the whole day",
    description:
      "Every appointment and walk-in in token order, with a live wait timer on anyone sitting outside. Arrived → Start consult → Done is one tap each.",
  },
  {
    icon: UserPlus,
    title: "Walk-ins in one field",
    description:
      "Type a phone number. If they have been before they come up instantly; if not, register them inline and they get a token without leaving the screen.",
  },
  {
    icon: CalendarDays,
    title: "Appointments that respect your hours",
    description:
      "A day view in your own slot length, with lunch breaks, weekly offs and holidays blocked out. Double-booking is allowed but warned about, because real clinics overbook on purpose.",
  },
  {
    icon: MessageCircle,
    title: "Tomorrow's reminders in one run",
    description:
      "One button opens a queue of everyone booked for tomorrow with the message already written. Tap, send, next — and the queue remembers its place if you close the tab.",
  },
  {
    icon: CalendarClock,
    title: "Follow-ups that come back to you",
    description:
      "“Review after 5 days” books the appointment on finalise, and the follow-ups report lists everyone due this week who has not booked yet. That report is the one that pays for the app.",
  },
  {
    icon: HeartPulse,
    title: "Nothing is lost mid-consultation",
    description:
      "The consultation is saved as you type. Close the tab, lose power, come back — the patient is still shown as in consult with a Resume button.",
  },
];

const RECORDS: Feature[] = [
  {
    icon: Users,
    title: "A patient chart worth opening",
    description:
      "Every visit newest first, collapsed to date and diagnosis, expanding to the full record with a print-again button. Allergies and chronic conditions sit in a red banner at the top where they cannot be missed.",
  },
  {
    icon: TrendingUp,
    title: "Weight and BP over time",
    description:
      "A small chart of how a chronic patient is actually tracking. It is the thing that makes a doctor keep using the app for diabetics and hypertensives.",
  },
  {
    icon: Upload,
    title: "Bring your existing register",
    description:
      "Paste it straight from Excel or upload a CSV. Nine hundred patients in one go, with names, phones, ages and conditions mapped from your own column headings.",
  },
  {
    icon: ClipboardList,
    title: "Ages that stay correct",
    description:
      "Record a date of birth or just “42 years” — whichever the patient knows. Either way the age is right when you open that chart three years later, and infants read in months.",
  },
];

const MONEY: Feature[] = [
  {
    icon: BadgeIndianRupee,
    title: "Follow-up fees applied automatically",
    description:
      "Set your consultation fee, your follow-up fee and the window. Someone returning inside it is billed at the follow-up rate — often zero — with the reason printed on the bill. Override it whenever you like.",
  },
  {
    icon: Receipt,
    title: "Receipts on your thermal printer",
    description:
      "58mm, 80mm or A4, numbered in your own series. Add your UPI ID and the receipt carries a QR the patient pays from directly into your account.",
  },
  {
    icon: FileSpreadsheet,
    title: "Reports that tell you something",
    description:
      "Footfall with new-versus-repeat, revenue by mode and by charge, your top diagnoses, no-show rate by day of week, and arrivals by hour so you can fix staffing. Everything exports to CSV.",
  },
  {
    icon: Download,
    title: "Backups you actually take",
    description:
      "One file holds the whole clinic and restores it onto a new device in a step. The app nags you when the last one is a fortnight old, because this browser is the only place your records live.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Is this really free?",
    answer:
      "Yes. There is no signup, no trial, no patient limit and no feature held back behind a payment. It runs entirely in your browser, so there is no server for us to charge you for. The paid Setu Clinic is a separate cloud product for clinics that need several doctors, several devices in step and automatic messaging.",
  },
  {
    question: "Where is my patient data stored?",
    answer:
      "In this browser on this device, in its local database. It is never uploaded, and we cannot see it. That is also the risk: clearing your browser data deletes it, so take a backup from Settings or connect a Google Sheet. Either restores the whole clinic onto a new device in one step.",
  },
  {
    question: "Do I need to download or install anything?",
    answer:
      "No. Open the page and start. It works on a laptop, a tablet at the desk and a phone, and once the page has loaded it keeps working with the internet off.",
  },
  {
    question: "How do I write a prescription on the computer with this?",
    answer:
      "Open the patient from today's list, fill in the vitals and complaints, then search each medicine and tap a dose like 1-0-1 with the number of days. The prescription builds on the right as you type. Press Finalise, then Print. On the next similar patient, load a saved protocol and the whole thing is filled in one tap.",
  },
  {
    question: "Can it print on my existing prescription pad?",
    answer:
      "Yes. Turn off “Print the clinic and doctor header” in Settings and the app leaves the top of the page blank for your pre-printed letterhead, printing only the patient line, the Rx and the signature. A5 and A4 are both supported.",
  },
  {
    question: "Does it check drug interactions or allergies?",
    answer:
      "No, and it says so on first run. This is a record-keeping and printing tool — it does not check doses, interactions or allergies, and gives no clinical advice. It will show a patient's recorded allergies as a red banner on the chart and on the prescription, but the prescribing decision is entirely the doctor's.",
  },
  {
    question: "Does it come with a list of medicines?",
    answer:
      "There is an optional starter list of about two hundred generics commonly stocked in Indian practice, with the salt and a usual strength. It is off until you tap “Add starter list” in Settings, and it deliberately carries no doses — you set those when you prescribe. Every row is yours to edit or delete, and anything you type during a consultation can be added to your own list afterwards.",
  },
  {
    question: "Is it suitable for a dental, physio or ayurveda clinic?",
    answer:
      "Yes. Nothing in it is specific to one speciality — the prescription, the complaints and the diagnosis are all free text, procedures are charges you define yourself, and protocols are whatever you save. It suits any OPD practice that sees patients, writes prescriptions and takes payment.",
  },
  {
    question: "Can it send WhatsApp reminders automatically?",
    answer:
      "No, and it is honest about that. With no server and no login there is nothing that could send on your behalf. The app writes each message and opens WhatsApp with it ready — you tap send, one patient at a time. Automatic sending needs a WhatsApp Business API account and is part of the paid Setu Clinic.",
  },
  {
    question: "Can more than one doctor use it?",
    answer:
      "The free app is built around a single doctor's practice — one prescribing list, one queue, one set of fees. You can add a second doctor, but per-doctor columns, split queues and separated revenue are part of the paid Setu Clinic. The data model already carries the doctor on every record, so moving up later is an import, not a re-entry.",
  },
  {
    question: "What happens to a patient's old prescriptions?",
    answer:
      "They stay on the chart forever, newest first, each one printable again exactly as issued. Editing a finalised consultation is allowed but the chart marks it as edited, so the record stays honest.",
  },
  {
    question: "Does the Google Sheet sync send my patients' diagnoses?",
    answer:
      "Yes — that is the point of it, and it is why the sync is off until you paste in a sheet URL of your own. The consultations tab includes diagnoses and prescribed medicines, in a Google Sheet inside your own Google account. If you would rather nothing left the device, use the backup file instead and leave sync off.",
  },
];

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Setu Free Clinic Manager",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Free clinic management software for prescriptions, patient records, appointments and billing. Works offline in the browser with all data stored on the device.",
  featureList: [
    "Prescription pad with medicine search by name or salt",
    "Auto-computed dispensing quantity from dose and duration",
    "Saved prescription protocols, loaded in one tap",
    "Prints A4 and A5 prescriptions as real text",
    "Investigation slips and patient chart export",
    "Patient register with allergy and chronic-condition alerts",
    "Vitals with automatic BMI and a weight/BP trend",
    "Today queue with tokens, walk-ins and live wait times",
    "Appointments with breaks, weekly offs and holidays",
    "WhatsApp appointment reminders and follow-up call lists",
    "Billing with automatic follow-up fees and UPI receipts",
    "Outstanding dues with reminders and part payments",
    "Footfall, revenue, top diagnoses and no-show reports",
    "Bulk patient import from CSV or a pasted register",
    "PIN lock, JSON backup and Google Sheet sync",
    "Works offline, no login required",
  ],
  offers: freeOffer({ url: "/products/free-clinic-software" }),
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

export default function FreeClinicSoftwarePage() {
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
              Free Clinic Management Software
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
              Prescriptions, patient records, appointments and billing — for single-doctor clinics,
              dentists, physios and small OPD practices. No login, no subscription, no internet
              needed.
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
        <ClinicApp />
      </section>

      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                The consultation
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                The prescription pad is the product
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Everything else exists so this screen is fast. Vitals, complaints and medicines on
                the left, the printed page building itself on the right.
              </p>
            </div>
          </FadeIn>
          <FeatureCards items={CONSULT} />
        </div>
      </section>

      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                The clinic day
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                Get through today&apos;s patients without paper
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Tokens, walk-ins, waiting times and appointments — one screen the front desk can
                live on from morning to close.
              </p>
            </div>
          </FadeIn>
          <FeatureCards items={DAY} />
        </div>
      </section>

      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                Patient records
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                Every visit, findable in a second
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Search by name, phone or file number and the whole history opens — with allergies
                where you cannot miss them.
              </p>
            </div>
          </FadeIn>
          <FeatureCards items={RECORDS} />
        </div>
      </section>

      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                Billing and reports
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">
                Know what the clinic actually earned
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Fees that apply themselves, receipts that print, and the handful of numbers that
                change how you run the place.
              </p>
            </div>
          </FadeIn>
          <FeatureCards items={MONEY} />
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
                reminder on its own, cannot keep the doctor&apos;s tablet and the front desk&apos;s
                computer in step, and is built around a single doctor&apos;s practice. Those need a
                server — and that is exactly what{" "}
                <Link href="/products/clinic" className="font-semibold text-indigo hover:underline">
                  Setu Clinic
                </Link>{" "}
                is being built for. Everything on this page stays free.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/products/clinic"
                  className="inline-block rounded-full bg-indigo px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  See Setu Clinic →
                </Link>
                <Link
                  href="/tools/appointment-book"
                  className="inline-block rounded-full border border-muted-line/30 px-6 py-2.5 text-sm font-semibold text-ink transition hover:border-indigo/40 hover:text-indigo"
                >
                  Just need an appointment book?
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

      <Faq headline="Free clinic software — questions" items={FAQ_ITEMS} />
    </>
  );
}
