import { PageHero } from "@/components/PageHero";
import { CalculatorCard } from "@/components/calculators/CalculatorCard";
import { CtaBanner } from "@/components/CtaBanner";
import { FadeIn } from "@/components/motion/FadeIn";
import { LanguageLinks } from "@/components/home/LanguageLinks";
import type { CalculatorsContent } from "@/lib/content";
import type { LanguageCode } from "@/lib/i18n/config";

/**
 * The calculator directory, shared by /calculators and its translations. The
 * closing banner's copy moved into content with the rest of the page — it used
 * to be written into the markup, which no translation could reach.
 */
export function CalculatorsSections({
  content,
  lang,
}: {
  content: CalculatorsContent;
  lang: LanguageCode;
}) {
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
                  <CalculatorCard key={item.slug} item={item} />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <LanguageLinks page="calculators" current={lang} />

      <CtaBanner {...content.ctaBanner} />
    </>
  );
}
