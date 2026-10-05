import { PageHero } from "@/components/PageHero";
import { ContactForm } from "@/components/ContactForm";
import { LanguageLinks } from "@/components/home/LanguageLinks";
import type { ContactContent } from "@/lib/content";
import type { LanguageCode } from "@/lib/i18n/config";

/**
 * The contact page body, shared by /contact and its translations.
 *
 * `hero` is passed in rather than read from `content` because the English page
 * swaps in a variant when the URL carries a ?topic — a demo enquiry and a
 * partnership enquiry open with different words.
 */
export function ContactSections({
  content,
  hero,
  lang,
}: {
  content: ContactContent;
  hero: { eyebrow: string; headline: string; subheadline: string };
  lang: LanguageCode;
}) {
  return (
    <>
      <PageHero eyebrow={hero.eyebrow} headline={hero.headline} subheadline={hero.subheadline} />

      <section className="mx-auto max-w-2xl px-6 py-12">
        <ContactForm form={content.form} />
      </section>

      <LanguageLinks page="contact" current={lang} />
    </>
  );
}
