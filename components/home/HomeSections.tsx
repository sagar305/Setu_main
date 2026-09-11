import type { HomeContent } from "@/lib/content";
import type { LanguageCode } from "@/lib/i18n/config";
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
import { LanguageLinks } from "@/components/home/LanguageLinks";
import { CtaBanner } from "@/components/CtaBanner";
import { Faq } from "@/components/Faq";

/**
 * The homepage body, shared by `/` and every translated homepage under
 * `/<lang>`. The sections are identical in each language — only the strings
 * differ — so keeping one component means a section added here appears in all
 * 17 versions instead of drifting between them.
 */
export function HomeSections({ content, lang }: { content: HomeContent; lang: LanguageCode }) {
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

  return (
    <>
      <Hero hero={content.hero} hiddenProductIds={hiddenHeroProductIds} />
      <ShowcaseGrid id="products" section={productsSection} className="bg-cream" />
      <ShowcaseGrid id="tools" section={content.tools} className="bg-white" />
      <ShowcaseGrid id="calculators" section={content.calculators} className="bg-cream" />
      <Services services={content.services} />
      <LatestBlogs />
      <Faq headline={content.faq.headline} items={content.faq.items} />
      <LanguageLinks current={lang} headline={content.languageLinks.headline} />
      <CtaBanner {...content.ctaBanner} />
    </>
  );
}
