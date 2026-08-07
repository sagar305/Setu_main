import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createGlossaryLinker,
  getGlossaryCategory,
  getGlossaryTermBySlug,
  getGlossaryTermSummaries,
  getGlossaryTermUrl,
  getGlossaryTerms,
  getGlossaryToolLinks,
} from "@/lib/content";
import { extractHeadings } from "@/lib/blog";
import { BlogTableOfContents } from "@/components/blog/BlogTableOfContents";
import { BlogFaq } from "@/components/blog/BlogFaq";
import { GlossarySidebar } from "@/components/glossary/GlossarySidebar";

const SITE_URL = "https://setutechnology.com";

const OG_IMAGES = [
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
];

export function generateStaticParams() {
  return getGlossaryTerms().map((term) => ({ slug: term.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const term = getGlossaryTermBySlug(slug);
  if (!term) return {};

  const url = getGlossaryTermUrl(term.slug);

  return {
    title: term.seoTitle,
    description: term.metaDescription,
    keywords: [term.term, ...(term.aliases ?? []), `${term.term} meaning`, `what is ${term.term}`],
    alternates: { canonical: url },
    openGraph: {
      title: term.seoTitle,
      description: term.metaDescription,
      url,
      type: "article",
      images: OG_IMAGES,
    },
    twitter: {
      card: "summary_large_image",
      title: term.seoTitle,
      description: term.metaDescription,
      images: OG_IMAGES.map((image) => image.url),
    },
  };
}

export default async function GlossaryTermPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const term = getGlossaryTermBySlug(slug);
  if (!term) notFound();

  const category = getGlossaryCategory(term.category);
  const tools = getGlossaryToolLinks(term.relatedTools, 5);
  const relatedTerms = getGlossaryTermSummaries(term.relatedTerms).slice(0, 6);

  // Link other glossary terms inside this entry's body, never the term itself.
  const linker = createGlossaryLinker({ maxLinks: 10, exclude: [term.slug] });
  const { html, headings } = extractHeadings(linker.html(term.bodyHtml));

  const definedTermSchema = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: term.term,
    description: term.definition,
    ...(term.aliases && term.aliases.length > 0 ? { alternateName: term.aliases } : {}),
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: "Setu Business Glossary",
      url: `${SITE_URL}/glossary`,
    },
    url: `${SITE_URL}${getGlossaryTermUrl(term.slug)}`,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Glossary", item: `${SITE_URL}/glossary` },
      {
        "@type": "ListItem",
        position: 3,
        name: term.term,
        item: `${SITE_URL}${getGlossaryTermUrl(term.slug)}`,
      },
    ],
  };

  const faqSchema =
    term.faq && term.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: term.faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }
      : null;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {faqSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}

      <nav aria-label="Breadcrumb" className="text-sm text-muted-warm">
        <Link href="/glossary" className="font-semibold text-indigo hover:underline">
          ← Glossary
        </Link>
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)_300px] lg:gap-12">
        {/* Left: sticky in-page navigation */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <BlogTableOfContents headings={headings} />
          </div>
        </aside>

        {/* Center: the entry */}
        <article className="min-w-0">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-warm">
            <span>Glossary</span>
            {category && (
              <>
                <span aria-hidden="true">·</span>
                <span>{category.name}</span>
              </>
            )}
            {term.updated && (
              <>
                <span aria-hidden="true">·</span>
                <time dateTime={term.updated}>
                  Updated{" "}
                  {new Date(term.updated).toLocaleDateString("en-IN", {
                    year: "numeric",
                    month: "short",
                  })}
                </time>
              </>
            )}
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink md:text-4xl">{term.term}</h1>

          {term.aliases && term.aliases.length > 0 && (
            <p className="mt-2 text-sm text-muted-warm">Also called: {term.aliases.join(", ")}</p>
          )}

          {/* The plain answer, first thing on the page. */}
          <div className="mt-6 rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-warm">
              What is {term.term}?
            </p>
            <p className="mt-3 text-lg leading-relaxed text-ink">{term.definition}</p>
          </div>

          <div className="blog-content mt-8" dangerouslySetInnerHTML={{ __html: html }} />

          {term.faq && <BlogFaq items={term.faq} />}

          {relatedTerms.length > 0 && (
            <section className="mt-14 border-t border-muted-line/30 pt-10">
              <h2 className="text-2xl font-bold tracking-tight text-ink">Related terms</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {relatedTerms.map((related) => (
                  <Link
                    key={related.slug}
                    href={getGlossaryTermUrl(related.slug)}
                    className="group rounded-2xl border border-muted-line/20 bg-white p-5 transition hover:border-indigo/40"
                  >
                    <span className="block font-semibold text-ink transition group-hover:text-indigo">
                      {related.term}
                    </span>
                    <span className="mt-1 block text-sm leading-snug text-muted">{related.short}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>

        {/* Right: top 5 tools and calculators for this term */}
        <aside className="min-w-0">
          <GlossarySidebar tools={tools} relatedTerms={relatedTerms.slice(0, 5)} />
        </aside>
      </div>
    </div>
  );
}
