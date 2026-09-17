import Link from "next/link";
import { Globe } from "lucide-react";
import { LANGUAGES } from "@/lib/i18n/config";
import type { LanguageCode } from "@/lib/i18n/config";
import { homePathFor, hreflangFor } from "@/lib/i18n/home-locales";

/**
 * Links to every translated homepage.
 *
 * hreflang tags in the <head> tell a crawler the versions exist; real links in
 * the body are how it reaches them, and how a reader who landed on the wrong
 * one switches. Each entry is labelled with its own endonym, so someone who
 * cannot read the current page can still find their language.
 */
export function LanguageLinks({
  current,
  headline,
}: {
  current: LanguageCode;
  headline: string;
}) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted-warm">
          <Globe className="h-4 w-4" aria-hidden="true" />
          {headline}
        </h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {LANGUAGES.map((language) => {
            const isCurrent = language.code === current;
            return (
              <li key={language.code}>
                <Link
                  href={homePathFor(language.code)}
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
