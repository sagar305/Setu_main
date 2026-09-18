import type { LanguageCode } from "./config";
import { localizedHref } from "./pages";

/**
 * Rewrites every `href` in a content tree to its version in `lang`.
 *
 * Content carries one href per link, written as the English path, because the
 * translations deliberately hold only reader-facing strings — structure, ids and
 * link targets have a single source of truth in content/en. That leaves every
 * translated page linking back into English: a reader on /hi taps "Products" and
 * is dropped onto the English /products, in the middle of a Hindi visit.
 *
 * Doing it here rather than in each component is what keeps it complete. The
 * hrefs are spread across the hero, the card grids, the services row, the CTA
 * banners, the header and the footer; threading the language into all of them
 * would fix the ones we remembered and silently miss the next one added. Every
 * page already loads its copy through one function, so rewriting the links as
 * the copy is loaded covers all of them at once and lets the components stay
 * language-agnostic.
 *
 * Only links to pages actually published in this language move — localizedHref
 * leaves the blog, the glossary, individual tool and calculator pages, and
 * anything external exactly as written, rather than inventing a route that 404s.
 */
export function localizeLinks<T>(value: T, lang: LanguageCode): T {
  if (lang === "en") return value;
  return rewrite(value, lang) as T;
}

/**
 * The link shape inside body prose, e.g. "See also our [terms](/terms)".
 *
 * Legal copy carries its links inline rather than as an href field, and
 * components/legal/RichText renders them as anchors — so they need localizing
 * too, or the privacy page in German sends the reader to the English terms.
 * This has to keep matching the link half of RichText's own pattern: a target
 * rewritten here that RichText does not recognise would be shown as raw text.
 */
const INLINE_LINK = /(\[[^\]]+\]\()([^)]+)(\))/g;

function localizeInlineLinks(text: string, lang: LanguageCode): string {
  if (!text.includes("](")) return text;
  return text.replace(INLINE_LINK, (_match, open, target, close) =>
    `${open}${localizedHref(target, lang)}${close}`,
  );
}

function rewrite(value: unknown, lang: LanguageCode): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((entry) => {
      const mapped = rewrite(entry, lang);
      if (mapped !== entry) changed = true;
      return mapped;
    });
    return changed ? next : value;
  }

  if (typeof value === "string") return localizeInlineLinks(value, lang);

  if (value === null || typeof value !== "object") return value;

  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const mapped =
      key === "href" && typeof entry === "string" ? localizedHref(entry, lang) : rewrite(entry, lang);
    if (mapped !== entry) changed = true;
    next[key] = mapped;
  }
  // Returning the original object when nothing moved keeps the cached English
  // content shared rather than cloned once per language.
  return changed ? next : value;
}
