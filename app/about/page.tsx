import type { Metadata } from "next";
import { getAboutContent } from "@/lib/content";
import { PageHero } from "@/components/PageHero";
import { CtaBanner } from "@/components/CtaBanner";

const content = getAboutContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/about" },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/about",
  },
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow={content.hero.eyebrow}
        headline={content.hero.headline}
        subheadline={content.hero.subheadline}
      />

      <section className="mx-auto max-w-3xl px-6 py-12">
        <h2 className="text-2xl font-bold text-ink">{content.story.headline}</h2>
        <div className="mt-6 flex flex-col gap-5">
          {content.story.paragraphs.map((p, i) => (
            <p key={i} className="leading-relaxed text-muted">
              {p}
            </p>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold text-ink">{content.mission.headline}</h2>
          <p className="mt-4 text-lg text-muted">{content.mission.body}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-bold text-ink">{content.values.headline}</h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          {content.values.items.map((item) => (
            <div key={item.heading}>
              <h3 className="text-lg font-semibold text-ink">{item.heading}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <CtaBanner {...content.cta} />
    </>
  );
}
