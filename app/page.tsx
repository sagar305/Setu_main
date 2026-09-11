import type { Metadata } from "next";
import { getHomeContent } from "@/lib/content";
import { homeLanguageAlternates } from "@/lib/i18n/home-locales";
import { faqPageSchema, webSiteSchema } from "@/lib/schema";
import { HomeSections } from "@/components/home/HomeSections";

const content = getHomeContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: {
    canonical: "/",
    // Every translated homepage, plus x-default. Listed here as well as on the
    // translations themselves because hreflang only counts when the pages name
    // each other — a one-way reference is ignored.
    languages: homeLanguageAlternates(),
  },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/",
    locale: "en_IN",
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
      {
        url: "/og/setu-og-image-500x261.png",
        width: 500,
        height: 261,
        alt: "Setu Technology - Setu for your business",
      },
    ],
  },
};

// Declares the site name for search engines and points them at /search, which
// is what enables the sitelinks search box.
const websiteSchema = webSiteSchema();

// The homepage is the page most likely to be cited for "what is Setu" queries,
// so the answers are structured as well as rendered. The questions are shown on
// the page below — FAQPage schema must describe visible content.
const faqSchema = faqPageSchema(content.faq.items, { hreflang: "en", path: "/" });

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <HomeSections content={content} lang="en" />
    </>
  );
}
