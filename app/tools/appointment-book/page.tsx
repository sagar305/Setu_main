import type { Metadata } from "next";
import { AppointmentBookTool } from "@/components/tools/AppointmentBook/AppointmentBookTool";
import { SuggestedTools } from "@/components/toolkit/SuggestedTools";

export const metadata: Metadata = {
  title: "Free Appointment Book | Salons, Clinics & Services | Setu Technology",
  description:
    "Book and manage appointments — day view, statuses, durations, no-shows. For salons, clinics, consultants and repair shops. Free, offline, no signup.",
  keywords: [
    "appointment book",
    "free appointment scheduler",
    "salon appointment book",
    "clinic appointment register",
    "appointment diary online",
  ],
  alternates: { canonical: "/tools/appointment-book" },
  openGraph: {
    title: "Free Appointment Book",
    description:
      "Day-wise appointment management for salons, clinics and services. Offline, no signup.",
    url: "/tools/appointment-book",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology Appointment Book",
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
      name: "Who is this appointment book for?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Any appointment-based business: salons, clinics, consultants, repair shops, tutors, lawyers. Day view, durations, statuses and no-show tracking.",
      },
    },
    {
      "@type": "Question",
      name: "Does it reuse my existing customers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. If you use other Setu tools on this device, connect your workspace and pick customers from the shared customer book instead of retyping them.",
      },
    },
    {
      "@type": "Question",
      name: "Is my appointment data private?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — everything stays in your browser on your device. No signup, no cloud, CSV export any time.",
      },
    },
  ],
};

export default function AppointmentBookPage() {
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
            Appointment Book
          </h1>
          <p className="mt-4 text-xl text-muted">
            Day-wise bookings, durations and statuses — for every appointment-based business.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <AppointmentBookTool />
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <SuggestedTools current="appointment-book" />
      </section>
    </>
  );
}
