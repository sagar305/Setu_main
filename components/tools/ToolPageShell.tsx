import type { ReactNode } from "react";
import type { ToolItem } from "@/lib/content";
import type { LanguageCode } from "@/lib/i18n/config";
import { ToolBody } from "@/components/tools/ToolBody";
import { ToolSchema } from "@/components/toolkit/ToolSchema";
import { SuggestedTools } from "@/components/toolkit/SuggestedTools";
import { GlossaryTermsStrip } from "@/components/glossary/GlossaryTermsStrip";

/**
 * Every tool page, in every language it is published in.
 *
 * The thirty-five pages under app/tools used to spell this out one by one: the
 * eyebrow, the h1, the subheadline and a FAQPage block of three to eight
 * questions, all written into the JSX. The words were therefore English on
 * every route, including the localized ones, and the pages ran to seventy lines
 * of markup each to say the same thing. They now pass their tool in here and
 * the copy comes from content/en/tools.json, overlaid with the translation for
 * whichever language the route serves.
 *
 * The FAQ stays JSON-LD only, as it was — these pages have never shown the
 * questions on the page itself, and this change is about where the copy lives,
 * not about adding a section to thirty-five pages.
 */
export function ToolPageShell({
  item,
  children,
  lang = "en",
  eyebrow,
  schema = false,
  suggested = false,
}: {
  item: ToolItem;
  /** The tool itself. */
  children: ReactNode;
  lang?: LanguageCode;
  /** "Free Tool" in the route's language. */
  eyebrow: string;
  /** Publish the SoftwareApplication block as well; not every page does. */
  schema?: boolean;
  /** Show the suggested-tools strip; not every page does. */
  suggested?: boolean;
}) {
  const faqSchema = item.faq
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: item.faq.items.map((entry) => ({
          "@type": "Question",
          name: entry.question,
          acceptedAnswer: { "@type": "Answer", text: entry.answer },
        })),
      }
    : undefined;

  return (
    <>
      {schema && <ToolSchema item={item} lang={lang} />}
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      <section className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <div className="text-center">
          <div className="mb-4 inline-block rounded-full bg-indigo/10 px-4 py-2">
            <span className="text-sm font-semibold text-indigo">{eyebrow}</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            {item.hero.headline}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">{item.hero.subheadline}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">{children}</section>

      {item.body && <ToolBody blocks={item.body} />}

      {suggested && (
        <section className="mx-auto max-w-4xl px-6 py-16">
          <SuggestedTools current={item.slug} lang={lang} />
        </section>
      )}

      <section className="mx-auto max-w-4xl px-6 pb-16">
        <GlossaryTermsStrip type="tool" slug={item.slug} />
      </section>
    </>
  );
}
