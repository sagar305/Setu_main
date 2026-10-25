import type { Metadata } from "next";
import Link from "next/link";
import {
  getBlogCategories,
  getBlogCategoryUrl,
  getBlogContent,
  getBlogPostUrl,
  getCalculatorsContent,
  getGlossaryTermUrl,
  getGlossaryTerms,
  getToolsContent,
} from "@/lib/content";
import {
  pharmacySoftwareEnabled,
  rentalSoftwareEnabled,
  repairSoftwareEnabled,
  tokenSystemEnabled,
} from "@/lib/featureFlags";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Sitemap | Every Page on Setu Technology",
  description:
    "A complete index of Setu Technology — products, pricing, free calculators and tools, blog categories, every article and glossary term, in one list.",
  alternates: { canonical: "/sitemap" },
};

type Section = { heading: string; links: { label: string; href: string }[] };

function buildSections(): Section[] {
  const blog = getBlogContent();

  return [
    {
      heading: "Company",
      links: [
        { label: "Home", href: "/" },
        { label: "About", href: "/about" },
        { label: "Team", href: "/team" },
        { label: "Consultancy", href: "/consultancy" },
        { label: "Pricing", href: "/pricing" },
        { label: "Contact", href: "/contact" },
        { label: "Book a demo", href: "/book-demo" },
      ],
    },
    {
      heading: "Products",
      links: [
        { label: "All products", href: "/products" },
        { label: "Browser Based POS", href: "/products/browser-based-pos" },
        { label: "Bank Statement Analyzer", href: "/products/bank-statement-analyzer" },
        { label: "TB Analyzer", href: "/products/tb-analyzer" },
        { label: "Free Dine — Free Restaurant POS", href: "/products/free-restaurant-pos" },
        { label: "Setu QR Menu", href: "/products/qr-menu" },
        { label: "Setu QR Menu — live demo", href: "https://demo.qr-menu.setutechnology.com/" },
        { label: "Tuition Class Manager", href: "/products/free-tuition-software" },
        { label: "Free Clinic Manager", href: "/products/free-clinic-software" },
        // Unreleased products appear only when their flag is on, matching
        // /products and sitemap.xml, so this page never links to a 404.
        ...(tokenSystemEnabled()
          ? [{ label: "Free Token System", href: "/products/free-token-system" }]
          : []),
        ...(rentalSoftwareEnabled()
          ? [{ label: "Free Rental & Hire Book", href: "/products/free-rental-software" }]
          : []),
        ...(pharmacySoftwareEnabled()
          ? [{ label: "Free Pharmacy POS", href: "/products/free-pharmacy-software" }]
          : []),
        ...(repairSoftwareEnabled()
          ? [{ label: "Free Repair Job Card", href: "/products/free-repair-shop-software" }]
          : []),
        { label: "Setu Dine", href: "/products/restaurant-pos" },
        { label: "Setu Queue", href: "/products/queue" },
        { label: "Setu Retail", href: "/products/retail" },
        { label: "Setu Tuition", href: "/products/tuition" },
        { label: "Setu Clinic", href: "/products/clinic" },
        { label: "Setu Workflow", href: "/products/workflow" },
      ],
    },
    {
      heading: "Calculators",
      links: [
        { label: "All calculators", href: "/calculators" },
        ...getCalculatorsContent().items.map((item) => ({
          label: item.name,
          href: `/calculators/${item.slug}`,
        })),
      ],
    },
    {
      heading: "Tools",
      links: [
        { label: "All tools", href: "/tools" },
        ...getToolsContent()
          .items.map((item) => ({
            label: item.name,
            href: "href" in item && item.href ? item.href : `/tools/${item.slug}`,
          }))
          // Browser Based POS and the Bank Statement Analyzer are listed under
          // Products already; one link per page keeps the count honest.
          .filter((link) => !link.href.startsWith("/products/")),
      ],
    },
    {
      heading: "Blog categories",
      links: [
        { label: "All posts", href: "/blog" },
        ...getBlogCategories().map((category) => ({
          label: category.name,
          href: getBlogCategoryUrl(category.slug),
        })),
      ],
    },
    {
      heading: "Articles",
      links: blog.posts.map((post) => ({ label: post.title, href: getBlogPostUrl(post) })),
    },
    {
      heading: "Glossary",
      links: [
        { label: "All terms", href: "/glossary" },
        ...getGlossaryTerms().map((term) => ({
          label: term.term,
          href: getGlossaryTermUrl(term.slug),
        })),
      ],
    },
    {
      heading: "Legal",
      links: [
        { label: "Privacy policy", href: "/privacy" },
        { label: "Terms of service", href: "/terms" },
        { label: "Refund & cancellation policy", href: "/refund-policy" },
      ],
    },
  ];
}

export default function SitemapPage() {
  const sections = buildSections();
  const total = sections.reduce((count, section) => count + section.links.length, 0);

  return (
    <>
      <PageHero
        eyebrow="Sitemap"
        headline="Every page on Setu"
        subheadline={`${total} pages, grouped by section. Internal viewer routes are left out.`}
      />

      <div className="mx-auto max-w-5xl px-6 pb-16">
        {sections.map((section) => (
          <section key={section.heading} className="mt-10 first:mt-0">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-warm">
              {section.heading}
            </h2>
            <ul className="mt-4 grid gap-x-8 gap-y-2.5 border-t border-muted-line/25 pt-5 sm:grid-cols-2 lg:grid-cols-3">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link
                    prefetch={false}
                    href={link.href}
                    className="text-sm text-ink transition hover:text-indigo hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
