import "server-only";

// Server-side loader for translated page copy.
//
// A translation lives in content/i18n/<page>/<lang>.json and holds only the
// strings a reader sees. It is overlaid on the English content (see
// ./home-merge), so structure — ids, link targets, the order of sections — has
// exactly one source of truth, and anything a translation has not reached yet
// falls back to English instead of disappearing.

import fs from "node:fs";
import path from "node:path";

import type { LanguageCode } from "./config";
import type { PageKey } from "./pages";
import { mergeTranslation } from "./home-merge";
import { localizeLinks } from "./localize-links";

const I18N_DIR = path.join(process.cwd(), "content", "i18n");

const cache = new Map<string, unknown>();

function loadTranslation(key: PageKey | "site", lang: LanguageCode): unknown {
  try {
    return JSON.parse(fs.readFileSync(path.join(I18N_DIR, key, `${lang}.json`), "utf8"));
  } catch {
    // No file yet for this language — the page still builds, in English.
    return null;
  }
}

/** Page content in `lang`, with any untranslated string falling back to English. */
export function getLocalizedContent<T>(
  key: PageKey | "site",
  lang: LanguageCode,
  english: T,
): T {
  if (lang === "en") return english;

  const id = `${key}:${lang}`;
  const cached = cache.get(id);
  if (cached) return cached as T;

  // Links are resolved after the merge, so a translation only ever has to carry
  // strings — the href it inherits from English is pointed at this language here.
  const merged = localizeLinks(mergeTranslation(english, loadTranslation(key, lang)), lang);
  cache.set(id, merged);
  return merged;
}
