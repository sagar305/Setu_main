"use client";

// The standing Google review ask along the top of the tool, calculator,
// glossary, product and blog pages. Which pages, the copy in every language and
// the on/off switch live in lib/reviewBanner.ts.
//
// It is rendered on the server rather than after mount, so the page does not
// jump when it appears. Closing it hides it for the rest of the visit; a reload
// brings it back, which is the point of a standing ask.

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, Star, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LANGUAGES } from "@/lib/i18n/config";
import { GOOGLE_REVIEW_URL, readReviewState, writeReviewState } from "@/lib/review";
import { REVIEW_BANNER_COPY, REVIEW_BANNER_ENABLED, reviewBannerRoute } from "@/lib/reviewBanner";

export function ReviewBanner() {
  const pathname = usePathname();
  const { lang: readerLang } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  const route = REVIEW_BANNER_ENABLED ? reviewBannerRoute(pathname) : null;
  if (!route || dismissed) return null;

  // This sits in the root layout, outside the provider a translated route sets
  // up, so the URL's own language is read here: /hi/tools/… is Hindi in the
  // server HTML, not only after hydration. English paths follow the reader's
  // chosen language, as the rest of the toolkit does.
  const lang = route.lang ?? readerLang;
  const copy = REVIEW_BANNER_COPY[lang] ?? REVIEW_BANNER_COPY.en;
  const dir = LANGUAGES.find((language) => language.code === lang)?.dir ?? "ltr";

  // Someone who goes to leave a review has answered the in-page prompt too.
  function markRated() {
    writeReviewState({ ...readReviewState(), ratedAt: Date.now() });
  }

  return (
    <aside
      aria-label={copy.label}
      lang={lang}
      dir={dir}
      className="relative z-[60] bg-indigo text-cream-paper"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-2.5 pe-12 sm:pe-14">
        <Star className="hidden h-4 w-4 shrink-0 text-saffron sm:block" aria-hidden="true" />
        <p className="text-xs leading-relaxed sm:text-sm">
          <span className="font-semibold">{copy.lead}</span>{" "}
          <span className="hidden text-cream-paper/85 sm:inline">{copy.body}</span>{" "}
          <a
            href={GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={markRated}
            data-analytics="review_banner_link"
            className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-saffron underline underline-offset-4 transition hover:brightness-110"
          >
            {copy.cta}
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
          </a>
        </p>
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={copy.dismiss}
        className="absolute end-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-cream-paper/70 transition hover:bg-white/10 hover:text-cream-paper"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  );
}
