import type { Metadata } from "next";
import { getHomeContent } from "@/lib/content";
import { Hero } from "@/components/home/Hero";
import { ShowcaseGrid } from "@/components/home/ShowcaseGrid";
import { Services } from "@/components/home/Services";
import { LatestBlogs } from "@/components/home/LatestBlogs";
import { CtaBanner } from "@/components/CtaBanner";
import { Faq } from "@/components/Faq";

const content = getHomeContent();

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
      <Hero hero={content.hero} />
      <ShowcaseGrid id="tools" section={content.tools} className="bg-cream" />
      <ShowcaseGrid id="calculators" section={content.calculators} className="bg-white" />
      <Services services={content.services} />
      <LatestBlogs />
      <Faq headline={content.faq.headline} items={content.faq.items} />
      <CtaBanner {...content.ctaBanner} />
    </>
  );
}
