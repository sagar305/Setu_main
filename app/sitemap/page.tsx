import type { Metadata } from "next";
import Link from "next/link";
import {
  getBlogCategories,
  getBlogCategoryUrl,
  getBlogContent,
  getBlogPostUrl,
  getCalculatorsContent,
  getToolsContent,
} from "@/lib/content";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Sitemap | Every Page on Setu Technology",
  description:
    "A complete index of Setu Technology — products, pricing, free calculators and business tools, blog categories and every published article, in one list.",
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
        { label: "Business glossary", href: "/glossary" },
      ],
    },
    {
      heading: "Products",
      links: [
        { label: "All products", href: "/products" },
        { label: "Browser Based POS", href: "/products/browser-based-pos" },
        { label: "Free Dine — Free Restaurant POS", href: "/products/free-restaurant-pos" },
        { label: "Setu QR Menu", href: "/products/qr-menu" },
        { label: "Setu Dine", href: "/products/restaurant-pos" },
        { label: "Setu Queue", href: "/products/queue" },
        { label: "Setu Retail", href: "/products/retail" },
        { label: "Setu Clinic", href: "/products/clinic" },
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
        ...getToolsContent().items.map((item) => ({
          label: item.name,
          href: "href" in item && item.href ? item.href : `/tools/${item.slug}`,
        })),
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
