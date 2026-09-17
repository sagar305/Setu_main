import "server-only";

// The header and footer, in the language of the page they sit on.
//
// Kept server-side on purpose. Nav and Footer take their strings as props, so
// the seventeen versions of the chrome never reach the browser: a page ships
// the one language it is written in. An earlier cut of this resolved the
// language in the client from the pathname, which worked but put every
// translation in the layout chunk — about 10 KB gzipped on every page of the
// site, for copy that sixteen URLs use.
//
// The translated homepages are laid out by app/[lang]/layout.tsx, which reads
// this; every other route keeps the English chrome from the root layout.

import { getSiteContent, type SiteContent } from "@/lib/content";
import type { LanguageCode } from "./config";
import { mergeTranslation } from "./home-merge";

import ar from "@/content/i18n/site/ar.json";
import bn from "@/content/i18n/site/bn.json";
import de from "@/content/i18n/site/de.json";
import es from "@/content/i18n/site/es.json";
import fr from "@/content/i18n/site/fr.json";
import gu from "@/content/i18n/site/gu.json";
import hi from "@/content/i18n/site/hi.json";
import id from "@/content/i18n/site/id.json";
import kn from "@/content/i18n/site/kn.json";
import ml from "@/content/i18n/site/ml.json";
import mr from "@/content/i18n/site/mr.json";
import pa from "@/content/i18n/site/pa.json";
import pt from "@/content/i18n/site/pt.json";
import ta from "@/content/i18n/site/ta.json";
import te from "@/content/i18n/site/te.json";
import zh from "@/content/i18n/site/zh.json";

const TRANSLATIONS: Partial<Record<LanguageCode, unknown>> = {
  ar, bn, de, es, fr, gu, hi, id, kn, ml, mr, pa, pt, ta, te, zh,
};

const cache = new Map<LanguageCode, SiteContent>();

/**
 * Site chrome in `lang`, overlaid on the English content.
 *
 * Anything a translation leaves out stays English, and link targets always come
 * from the English file — every version links to the same routes.
 */
export function getLocalizedSiteContent(lang: LanguageCode): SiteContent {
  const english = getSiteContent();
  if (lang === "en") return english;

  const cached = cache.get(lang);
  if (cached) return cached;

  const merged = mergeTranslation(english, TRANSLATIONS[lang]);
  cache.set(lang, merged);
  return merged;
}
