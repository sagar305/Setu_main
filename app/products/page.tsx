import type { Metadata } from "next";
import Link from "next/link";
import { getProductsContent } from "@/lib/content";
import { PageHero } from "@/components/PageHero";

const content = getProductsContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/products" },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/products",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Setu Technology - Setu for your business",
      },
    ],
  },
};

export default function ProductsPage() {
  return (
    <>
      <PageHero
        eyebrow={content.hero.eyebrow}
        headline={content.hero.headline}
        subheadline={content.hero.subheadline}
      />

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex flex-col gap-10">
          {content.products.map((product) => {
            const isLive = product.status === "live";
            return (
              <div
                key={product.id}
                id={product.id}
                className={`rounded-2xl border p-8 ${
                  isLive ? "border-indigo/15 bg-white shadow-sm" : "border-muted-line/30 bg-white/50"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-bold text-ink">{product.name}</h2>
                  {!isLive && (
                    <span className="rounded-full bg-cream px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-warm">
                      Coming Soon
                    </span>
                  )}
                </div>
                <p className="mt-2 text-base font-medium text-indigo">{product.headline}</p>
                <p className="mt-4 max-w-2xl text-muted leading-relaxed">{product.description}</p>

                {product.features && (
                  <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                    {product.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-ink/80">
                        <span className="h-1.5 w-1.5 rounded-full bg-saffron" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}

                <Link
                  href={product.cta.href}
                  className="mt-6 inline-block text-sm font-semibold text-indigo hover:underline"
                >
                  {product.cta.label} →
                </Link>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
