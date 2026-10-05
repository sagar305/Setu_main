import Link from "next/link";
import { Globe } from "lucide-react";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n/config";
import { hreflangFor, languagesFor, pathFor, type PageKey } from "@/lib/i18n/pages";
import { getLocalizedContent } from "@/lib/i18n/page-content";
import { getSiteContent } from "@/lib/content";

/**
 * Links to every translated version of the page.
 *
 * hreflang tags in the <head> tell a crawler the versions exist; real links in
 * the body are how it reaches them, and how a reader who landed on the wrong
 * one switches. Each entry is labelled with its own endonym, so someone who
 * cannot read the current page can still find their language — and only
 * languages this page has actually been translated into are listed.
 */
export function LanguageLinks({ page, current }: { page: PageKey; current: LanguageCode }) {
  const published = languagesFor(page);
  if (published.length < 2) return null;

  // The heading is chrome rather than page copy, so it comes from site.json —
  // in the language of the page it is sitting on.
  const { headline } = getLocalizedContent("site", current, getSiteContent()).languageLinks;

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted-warm">
          <Globe className="h-4 w-4" aria-hidden="true" />
          {headline}
        </h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {LANGUAGES.filter((language) => published.includes(language.code)).map((language) => {
            const isCurrent = language.code === current;
            return (
              <li key={language.code}>
                <Link
                  href={pathFor(page, language.code)}
                  hrefLang={hreflangFor(language.code)}
                  lang={language.code}
                  dir={language.dir}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`inline-block rounded-full border px-4 py-2 text-sm transition ${
                    isCurrent
                      ? "border-indigo bg-indigo/5 font-semibold text-indigo"
                      : "border-muted-line/40 text-muted hover:border-indigo/40 hover:text-indigo"
                  }`}
                >
                  {language.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
