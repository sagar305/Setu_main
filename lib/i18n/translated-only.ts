// Long-form copy on a translated page shows only as far as it is translated.
//
// mergeTranslation fills anything a translation has not reached with English,
// which suits labels and short strings: a new card turns up in every language
// at once. It does not suit an explainer, a worked example or a run of FAQ
// answers. Ten paragraphs of English under a Hindi headline is a worse page
// than one without them, and search engines read it as a mixed-language page.
// So these lists are cut back to the length the translation actually carries,
// and grow on that page as the translation catches up.
//
// Pure, so it can be unit tested; the routes hand it the raw translation.

/** Where a long-form list lives on an item, e.g. ["faq", "items"]. */
export type ListPath = readonly string[];

function at(value: unknown, path: ListPath): unknown {
  let current = value;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * `item` with each list at `paths` trimmed to the length of the same list in
 * `patch` (to nothing, when the translation lacks it). A top-level section left
 * empty is removed so the page skips it; a nested list — an FAQ's questions —
 * stays as an empty list, so the object around it keeps the shape its type
 * promises and the page checks the length.
 */
export function keepTranslatedOnly<T>(item: T, patch: unknown, paths: readonly ListPath[]): T {
  let result = item;

  for (const path of paths) {
    const list = at(result, path);
    if (!Array.isArray(list)) continue;

    const translated = at(patch, path);
    const length = Array.isArray(translated) ? Math.min(translated.length, list.length) : 0;
    if (length === list.length) continue;

    const trimmed = list.slice(0, length);
    if (path.length === 1 && trimmed.length === 0) {
      const { [path[0]]: _dropped, ...others } = result as Record<string, unknown>;
      result = others as T;
    } else {
      result = replaceAt(result, path, trimmed);
    }
  }

  return result;
}

function replaceAt<T>(value: T, path: ListPath, list: unknown[]): T {
  const [key, ...rest] = path;
  const record = value as Record<string, unknown>;

  if (rest.length === 0) {
    return { ...record, [key]: list } as T;
  }

  return { ...record, [key]: replaceAt(record[key], rest, list) } as T;
}
