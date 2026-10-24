import { ContactForm } from "@/components/ContactForm";
import { LanguageLinks } from "@/components/home/LanguageLinks";
import { ContactHero, type ContactHeroContent } from "@/components/contact/ContactHero";
import type { ContactContent } from "@/lib/content";
import type { LanguageCode } from "@/lib/i18n/config";

/**
 * The contact page body, shared by /contact and its translations.
 *
 * `hero` is passed in rather than read from `content` because translations
 * supply their own. The English page also passes `variants`, swapped in when
 * the URL carries a ?topic — a demo enquiry and a partnership enquiry open with
 * different words.
 */
export function ContactSections({
  content,
  hero,
  variants,
  lang,
}: {
  content: ContactContent;
  hero: ContactHeroContent;
  variants?: Record<string, ContactHeroContent>;
  lang: LanguageCode;
}) {
  return (
    <>
      <ContactHero hero={hero} variants={variants} />

      <section className="mx-auto max-w-2xl px-6 py-12">
        <ContactForm form={content.form} />
      </section>

      <LanguageLinks page="contact" current={lang} />
    </>
  );
}
