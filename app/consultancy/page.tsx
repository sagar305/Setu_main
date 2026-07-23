import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { getConsultancyContent } from "@/lib/content";
import { PageHero } from "@/components/PageHero";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";

const content = getConsultancyContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/consultancy" },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/consultancy",
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

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <FadeInStaggerItem className="flex items-start gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo/10 text-indigo">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      <span className="text-base leading-relaxed text-muted">{children}</span>
    </FadeInStaggerItem>
  );
}

export default function ConsultancyPage() {
  return (
    <>
      <PageHero
        eyebrow={content.hero.eyebrow}
        headline={content.hero.headline}
        subheadline={content.hero.subheadline}
      />

      {/* Frequency options */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <FadeIn>
          <div className="rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-ink">{content.frequency.headline}</h2>
            <p className="mt-2 text-sm text-muted">{content.frequency.subtext}</p>
            <FadeInStagger className="mt-5 flex flex-wrap gap-2">
              {content.frequency.options.map((option) => (
                <FadeInStaggerItem key={option}>
                  <span className="inline-block rounded-full bg-cream px-4 py-2 text-sm font-medium text-ink transition hover:bg-indigo/10 hover:text-indigo">
                    {option}
                  </span>
                </FadeInStaggerItem>
              ))}
            </FadeInStagger>
          </div>
        </FadeIn>
      </section>

      {/* Overview — full scope of book maintenance */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <FadeIn className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-ink">{content.overview.headline}</h2>
          <p className="mt-4 text-lg text-muted">{content.overview.intro}</p>
        </FadeIn>
        <FadeInStagger className="mt-8 grid gap-4 sm:grid-cols-2">
          {content.overview.items.map((item) => (
            <CheckItem key={item}>{item}</CheckItem>
          ))}
        </FadeInStagger>
      </section>

      {/* Services included */}
      <section className="bg-cream py-16">
        <div className="mx-auto max-w-5xl px-6">
          <FadeIn className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-ink">
              {content.servicesIncluded.headline}
            </h2>
            <p className="mt-4 text-lg text-muted">{content.servicesIncluded.subtext}</p>
          </FadeIn>
          <FadeInStagger className="mt-8 grid gap-4 sm:grid-cols-2">
            {content.servicesIncluded.items.map((item) => (
              <FadeInStaggerItem
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-transparent bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo/15 hover:shadow-md"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo/10 text-indigo">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="text-base leading-relaxed text-muted">{item}</span>
              </FadeInStaggerItem>
            ))}
          </FadeInStagger>
        </div>
      </section>

      {/* Software expertise */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <FadeIn className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-ink">{content.software.headline}</h2>
          <p className="mt-4 text-lg text-muted">{content.software.subtext}</p>
        </FadeIn>
        <FadeInStagger className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {content.software.items.map((item) => (
            <FadeInStaggerItem
              key={item.name}
              className="flex items-center gap-4 rounded-2xl border border-muted-line/30 bg-white p-5 transition hover:-translate-y-1 hover:border-indigo/20 hover:shadow-md"
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold uppercase text-white"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              >
                {item.mark}
              </span>
              <span>
                <span className="block text-lg font-semibold text-ink">{item.name}</span>
                <span className="mt-0.5 block text-sm text-muted">{item.detail}</span>
              </span>
            </FadeInStaggerItem>
          ))}
        </FadeInStagger>
      </section>

      {/* Ideal for */}
      <section className="bg-cream py-16">
        <div className="mx-auto max-w-5xl px-6">
          <FadeIn className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-ink">{content.idealFor.headline}</h2>
            <p className="mt-4 text-lg text-muted">{content.idealFor.subtext}</p>
          </FadeIn>
          <FadeInStagger className="mt-8 grid gap-4 sm:grid-cols-3">
            {content.idealFor.items.map((item) => (
              <FadeInStaggerItem
                key={item}
                className="rounded-2xl border border-indigo/15 bg-white p-5 text-base leading-relaxed text-muted transition hover:-translate-y-1 hover:shadow-md"
              >
                {item}
              </FadeInStaggerItem>
            ))}
          </FadeInStagger>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-indigo py-16 text-center text-cream-paper">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-3xl font-bold tracking-tight">{content.cta.headline}</h2>
          <p className="mt-4 text-lg text-cream-paper/85">{content.cta.subtext}</p>
          <Link
            href={content.cta.cta.href}
            className="mt-8 inline-block rounded-full bg-saffron px-7 py-3 text-sm font-semibold text-ink transition hover:brightness-95"
          >
            {content.cta.cta.label} →
          </Link>
        </div>
      </section>
    </>
  );
}
