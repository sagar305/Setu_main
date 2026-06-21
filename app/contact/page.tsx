import type { Metadata } from "next";
import Link from "next/link";
import { getContactContent } from "@/lib/content";
import { PageHero } from "@/components/PageHero";
import { ContactForm } from "@/components/ContactForm";

const content = getContactContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/contact" },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/contact",
  },
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow={content.hero.eyebrow}
        headline={content.hero.headline}
        subheadline={content.hero.subheadline}
      />

      <section className="mx-auto grid max-w-4xl gap-10 px-6 py-12 md:grid-cols-[1.2fr_1fr]">
        <ContactForm form={content.form} />

        <div className="flex flex-col gap-4 rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">{content.directContact.headline}</h2>
          <a
            href={`mailto:${content.directContact.email}`}
            className="text-sm font-semibold text-indigo hover:underline"
          >
            {content.directContact.email}
          </a>
          <div className="mt-4 border-t border-muted-line/20 pt-4">
            <p className="text-sm text-muted">{content.directContact.demoNote}</p>
            <Link
              href={content.directContact.demoCta.href}
              className="mt-2 inline-block text-sm font-semibold text-indigo hover:underline"
            >
              {content.directContact.demoCta.label} →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
