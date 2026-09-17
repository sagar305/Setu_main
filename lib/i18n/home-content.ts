import "server-only";

// Server-side loader for the translated homepage copy.
//
// Translations live in content/i18n/home/<lang>.json and hold only the strings
// a reader sees. They are overlaid on content/en/home.json (see ./home-merge),
// so structure — card ids, link targets, the order of the sections — has
// exactly one source of truth.

import fs from "node:fs";
import path from "node:path";

import { getHomeContent, type HomeContent } from "@/lib/content";
import type { LanguageCode } from "./config";
import { mergeTranslation } from "./home-merge";

const HOME_I18N_DIR = path.join(process.cwd(), "content", "i18n", "home");

const cache = new Map<LanguageCode, HomeContent>();

function loadTranslation(lang: LanguageCode): unknown {
  try {
    return JSON.parse(fs.readFileSync(path.join(HOME_I18N_DIR, `${lang}.json`), "utf8"));
  } catch {
    // No file yet for this language — the page still builds, in English.
    return null;
  }
}

/** Homepage content in `lang`, with any untranslated string falling back to English. */
export function getLocalizedHomeContent(lang: LanguageCode): HomeContent {
  const english = getHomeContent();
  if (lang === "en") return english;

  const cached = cache.get(lang);
  if (cached) return cached;

  const merged = mergeTranslation(english, loadTranslation(lang));
  cache.set(lang, merged);
  return merged;
}
