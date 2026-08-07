import type { Metadata } from "next";
import { getGlossaryCategories, getGlossaryContent, getGlossaryTermUrl } from "@/lib/content";
import { PageHero } from "@/components/PageHero";
import { GlossaryIndexList } from "@/components/glossary/GlossaryIndexList";

const content = getGlossaryContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/glossary" },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/glossary",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology - Setu for your business",
      },
      {
        url: "/og/setu-og-image-800x418.png",
        width: 800,
        height: 418,
        alt: "Setu Technology - Setu for your business",
      },
    ],
  },
};

const definedTermSetSchema = {
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  name: "Setu Business Glossary",
  description: content.seo.description,
  url: "https://setutechnology.com/glossary",
  hasDefinedTerm: content.terms.map((term) => ({
    "@type": "DefinedTerm",
    name: term.term,
    description: term.short,
    url: `https://setutechnology.com${getGlossaryTermUrl(term.slug)}`,
  })),
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://setutechnology.com" },
    { "@type": "ListItem", position: 2, name: "Glossary", item: "https://setutechnology.com/glossary" },
  ],
};

export default function GlossaryPage() {
  const categories = getGlossaryCategories();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermSetSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <PageHero
        eyebrow={content.hero.eyebrow}
        headline={content.hero.headline}
        subheadline={content.hero.subheadline}
      />

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <GlossaryIndexList terms={content.terms} categories={categories} />
      </section>
    </>
  );
}
