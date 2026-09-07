import type { Metadata } from "next";
import { getHomeContent } from "@/lib/content";
import {
  pharmacySoftwareEnabled,
  rentalSoftwareEnabled,
  repairSoftwareEnabled,
  tokenSystemEnabled,
} from "@/lib/featureFlags";
import { Hero } from "@/components/home/Hero";
import { ShowcaseGrid } from "@/components/home/ShowcaseGrid";
import { Services } from "@/components/home/Services";
import { LatestBlogs } from "@/components/home/LatestBlogs";
import { CtaBanner } from "@/components/CtaBanner";
import { Faq } from "@/components/Faq";

const content = getHomeContent();

/**
 * The product row skips anything not launched yet, so the homepage never
 * links to a route the feature flags 404. The cards behind it close the gap,
 * which is why the row is filtered rather than padded.
 */
const productCards = content.products.cards.filter((card) => {
  if (card.id === "free-token") return tokenSystemEnabled();
  if (card.id === "free-rental") return rentalSoftwareEnabled();
  if (card.id === "free-pharmacy") return pharmacySoftwareEnabled();
  if (card.id === "free-repair") return repairSoftwareEnabled();
  return true;
});

const productsSection = { ...content.products, cards: productCards };

/**
 * Panel entries the hero must not rotate through.
 *
 * The flags are server-only, and HeroVisual is a client component, so the
 * decision has to be made here and handed over as plain strings.
 */
const hiddenHeroProductIds = [
  ...(tokenSystemEnabled() ? [] : ["free-token"]),
  ...(rentalSoftwareEnabled() ? [] : ["free-rental"]),
  ...(pharmacySoftwareEnabled() ? [] : ["free-pharmacy"]),
  ...(repairSoftwareEnabled() ? [] : ["free-repair"]),
];

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/" },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/",
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
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Setu Technology",
  alternateName: "Setu",
  url: "https://setutechnology.com",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://setutechnology.com/search?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

// The homepage is the page most likely to be cited for "what is Setu" queries,
// so the answers are structured as well as rendered. The questions are shown on
// the page below — FAQPage schema must describe visible content.
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: content.faq.items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

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
      <Hero hero={content.hero} hiddenProductIds={hiddenHeroProductIds} />
      <ShowcaseGrid id="products" section={productsSection} className="bg-cream" />
      <ShowcaseGrid id="tools" section={content.tools} className="bg-white" />
      <ShowcaseGrid id="calculators" section={content.calculators} className="bg-cream" />
      <Services services={content.services} />
      <LatestBlogs />
      <Faq headline={content.faq.headline} items={content.faq.items} />
      <CtaBanner {...content.ctaBanner} />
    </>
  );
}
