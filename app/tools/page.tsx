import type { Metadata } from "next";
import { getToolsContent } from "@/lib/content";
import { PageHero } from "@/components/PageHero";
import { CalculatorCard } from "@/components/calculators/CalculatorCard";
import { CtaBanner } from "@/components/CtaBanner";
import { FadeIn } from "@/components/motion/FadeIn";

const content = getToolsContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/tools" },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/tools",
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

export default function ToolsPage() {
  return (
    <>
      <PageHero
        eyebrow={content.hero.eyebrow}
        headline={content.hero.headline}
        subheadline={content.hero.subheadline}
      />

      <section className="mx-auto max-w-5xl px-6 pb-20">
        {content.categories.map((category) => {
          const items = content.items.filter((item) => item.category === category.id);
          if (items.length === 0) return null;

          return (
            <div key={category.id} className="mb-14">
              <FadeIn>
                <h2 className="text-xl font-bold tracking-tight text-ink">{category.name}</h2>
              </FadeIn>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <CalculatorCard key={item.slug} item={item as any} />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <CtaBanner
        headline="Want the numbers to track themselves?"
        subtext="Setu Dine tracks sales, cost and tax automatically, so you spend less time on calculators and more time running your business."
        cta={{ label: "Book a demo", href: "/book-demo?product=Setu%20Dine" }}
      />
    </>
  );
}
