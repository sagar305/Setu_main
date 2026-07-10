import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHero } from "@/components/PageHero";
import { BookDemoForm } from "@/components/BookDemoForm";

export const metadata: Metadata = {
  title: "Book a demo | Setu Technology",
  description: "Book a free demo of Setu's products — pick a date and time and we'll get back to confirm.",
  alternates: { canonical: "/book-demo" },
  openGraph: {
    title: "Book a demo | Setu Technology",
    description: "Book a free demo of Setu's products — pick a date and time and we'll get back to confirm.",
    url: "/book-demo",
    images: [
      {
        url: "/og/setu-og-image.png",
        width: 1200,
        height: 630,
        alt: "Setu Technology - Setu for your business",
      },
    ],
  },
};

export default function BookDemoPage() {
  return (
    <>
      <PageHero
        eyebrow="Book a demo"
        headline="Let's show you Setu in action"
        subheadline="Pick a date and time that works for you. We'll confirm by email."
      />

      <section className="mx-auto max-w-xl px-6 py-12">
        <Suspense>
          <BookDemoForm />
        </Suspense>
      </section>
    </>
  );
}
