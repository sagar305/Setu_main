import type { ReactNode } from "react";
import { PageHero } from "@/components/PageHero";
import { RichText } from "@/components/legal/RichText";
import type { LegalContent } from "@/lib/content";

/**
 * The body shared by the privacy policy and the terms of use, in English and in
 * every language they are published in. Both pages are a hero, a date, and a
 * run of headed sections, so one component renders both from content.
 */
export function LegalPage({
  content,
  translated = false,
  optOut,
}: {
  content: LegalContent;
  /**
   * Set on a translated version. Legal text governs, so a translation says so
   * rather than quietly implying it is the operative document.
   */
  translated?: boolean;
  /** The analytics opt-out control, rendered in the section that asks for it. */
  optOut?: ReactNode;
}) {
  return (
    <>
      <PageHero
        eyebrow={content.hero.eyebrow}
        headline={content.hero.headline}
        subheadline={content.hero.subheadline}
      />

      <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <p className="text-sm text-muted">{content.lastUpdated}</p>

        {translated && (
          <p className="mt-4 rounded-lg border border-muted-line/40 bg-cream px-4 py-3 text-sm text-muted">
            {content.translationNote}
          </p>
        )}

        {content.sections.map((section) => (
          <section key={section.id} className="mt-10">
            <h2 className="text-xl font-bold text-ink">{section.heading}</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
              {section.paragraphs?.map((text, index) => (
                <p key={index}>
                  <RichText text={text} />
                </p>
              ))}

              {section.list && (
                <ul className="list-disc space-y-1.5 pl-5">
                  {section.list.map((text, index) => (
                    <li key={index}>
                      <RichText text={text} />
                    </li>
                  ))}
                </ul>
              )}

              {section.optOut && optOut && <div className="pt-2">{optOut}</div>}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
