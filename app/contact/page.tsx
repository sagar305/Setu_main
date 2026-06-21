import type { Metadata } from "next";
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

      <section className="mx-auto max-w-2xl px-6 py-12">
        <ContactForm form={content.form} />
      </section>
    </>
  );
}
