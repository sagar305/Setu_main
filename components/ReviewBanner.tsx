"use client";

// The standing Google review ask along the top of the tool, calculator,
// glossary, product and blog pages. Which pages, the copy in every language and
// the on/off switch live in lib/reviewBanner.ts.
//
// It is rendered on the server rather than after mount, so the page does not
// jump when it appears. Closing it hides it for the rest of the visit; a reload
// brings it back, which is the point of a standing ask.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, Star, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LANGUAGES } from "@/lib/i18n/config";
import { GOOGLE_REVIEW_URL, readReviewState, writeReviewState } from "@/lib/review";
import { REVIEW_BANNER_COPY, REVIEW_BANNER_ENABLED, reviewBannerRoute } from "@/lib/reviewBanner";
// TEMPORARY — DIWALI 2026: remove after Diwali, see lib/festive.ts.
import { DIWALI_BANNER_COPY } from "@/lib/reviewBanner";
import { currentFestival } from "@/lib/festive";
import { Diya } from "@/components/Diya";

/** TEMPORARY — DIWALI 2026: bulbs in each string of lights; enough for 2560px. */
const LIGHT_BULBS = 160;

export function ReviewBanner() {
  const pathname = usePathname();
  const { lang: readerLang } = useI18n();
  const [dismissed, setDismissed] = useState(false);
  // TEMPORARY — DIWALI 2026. What shows is switched by CSS from the attribute
  // lib/festive.ts sets before paint, so there is no flash. This state only
  // names the landmark correctly for screen readers once the page is running.
  const [diwali, setDiwali] = useState(false);
  useEffect(() => setDiwali(currentFestival() === "diwali"), []);

  const route = REVIEW_BANNER_ENABLED ? reviewBannerRoute(pathname) : null;
  if (!route || dismissed) return null;

  // This sits in the root layout, outside the provider a translated route sets
  // up, so the URL's own language is read here: /hi/tools/… is Hindi in the
  // server HTML, not only after hydration. English paths follow the reader's
  // chosen language, as the rest of the toolkit does.
  const lang = route.lang ?? readerLang;
  const copy = REVIEW_BANNER_COPY[lang] ?? REVIEW_BANNER_COPY.en;
  const diwaliCopy = DIWALI_BANNER_COPY[lang] ?? DIWALI_BANNER_COPY.en;
  const dir = LANGUAGES.find((language) => language.code === lang)?.dir ?? "ltr";

  // Someone who goes to leave a review has answered the in-page prompt too.
  function markRated() {
    writeReviewState({ ...readReviewState(), ratedAt: Date.now() });
  }

  return (
    <aside
      aria-label={diwali ? diwaliCopy.lead : copy.label}
      lang={lang}
      dir={dir}
      className="relative z-[60] overflow-hidden bg-indigo text-cream-paper"
    >
      {/* TEMPORARY — DIWALI 2026: strings of lights along both edges. */}
      <DiwaliLights edge="top" />
      <DiwaliLights edge="bottom" />

      <div className="diwali-banner-inner mx-auto flex max-w-6xl items-center gap-3 px-6 py-2.5 pe-12 sm:pe-14">
        <Star className="diwali-hide hidden h-4 w-4 shrink-0 text-saffron sm:block" aria-hidden="true" />

        {/* TEMPORARY — DIWALI 2026: the greeting, with a diya at each end. */}
        <Diya className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
        <p className="diwali-show min-w-0 flex-1 text-center text-xs leading-relaxed sm:text-sm">
          <span className="font-semibold text-[#FFE08A]">{diwaliCopy.lead}</span>{" "}
          <span className="hidden text-cream-paper/85 sm:inline">{diwaliCopy.body}</span>
        </p>
        <Diya className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />

        <p className="diwali-hide text-xs leading-relaxed sm:text-sm">
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

/**
 * TEMPORARY — DIWALI 2026. Remove after Diwali.
 *
 * A string of small twinkling bulbs along one edge of the banner, in the
 * colours of Diwali lights. Hidden unless <html data-festive="diwali">.
 */
const BULB_COLOURS = ["#FFD36E", "#FF5E7E", "#7CE38B", "#6EC8FF", "#F2A03D"];

function DiwaliLights({ edge }: { edge: "top" | "bottom" }) {
  return (
    <span
      aria-hidden="true"
      className={`diwali-lights diwali-show pointer-events-none absolute inset-x-0 ${
        edge === "top" ? "top-0" : "bottom-0"
      }`}
    >
      {Array.from({ length: LIGHT_BULBS }, (_, i) => (
        <span
          key={i}
          className="diwali-bulb"
          style={{
            background: BULB_COLOURS[i % BULB_COLOURS.length],
            color: BULB_COLOURS[i % BULB_COLOURS.length],
            // Alternate bulbs, offset between the two strings, like a chaser.
            animationDelay: `${((i + (edge === "top" ? 0 : 1)) % 3) * 400}ms`,
          }}
        />
      ))}
    </span>
  );
}
