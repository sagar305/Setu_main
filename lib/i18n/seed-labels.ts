// Re-languaging the sample labels a worksheet opens on.
//
// Tools like the Trial Balance and the financial statements start on a worked
// example whose line labels are seeded in the reader's language. That state is
// then saved to localStorage under one key, so without this the first language
// a reader happened to open the tool in would be the language of the example
// for ever: open it once in Hindi, and the English page still shows Hindi
// account names.
//
// The example is ours, not the reader's. A label that is still exactly one of
// our seeds — in any language we publish — is sample text and follows the
// reader. Anything else is something they typed, and is returned untouched,
// including when the language changes. That also means a half-edited worksheet
// keeps the rows its owner wrote and re-languages only the ones they left.

import { LANGUAGES, type LanguageCode } from "./config";
import { translate, type TKey } from "./translate";

/**
 * The same label in `lang`, if it is one of `keys` in any published language;
 * otherwise the label exactly as it was given.
 */
export function relabelSeed(label: string, keys: readonly TKey[], lang: LanguageCode): string {
  const text = label.trim();
  if (!text) return label;
  for (const key of keys) {
    for (const { code } of LANGUAGES) {
      if (text === translate(code, key)) return translate(lang, key);
    }
  }
  return label;
}

/**
 * Re-language the seeded labels in a list of lines, returning the same array
 * when nothing changed so an untouched tool does not write to storage.
 */
export function relabelSeedLines<T extends { label: string }>(
  lines: T[],
  keys: readonly TKey[],
  lang: LanguageCode
): T[] {
  let changed = false;
  const next = lines.map((line) => {
    const label = relabelSeed(line.label, keys, lang);
    if (label === line.label) return line;
    changed = true;
    return { ...line, label };
  });
  return changed ? next : lines;
}
