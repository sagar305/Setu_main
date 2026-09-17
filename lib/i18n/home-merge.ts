// Overlay rules for the translated homepage copy.
//
// Pure and free of `server-only` so it can be unit tested; the file loading
// around it lives in ./home-content.ts.

/**
 * Overlay a translation on the English content.
 *
 * Only keys the English content already has are taken from the patch, and only
 * when the two sides have the same shape. That keeps a malformed translation
 * from reshaping the page — the worst it can do is leave a string in English.
 * Arrays line up by index, so a card added to the English file appears in every
 * language immediately (in English) instead of shifting the translated ones.
 */
export function mergeTranslation<T>(base: T, patch: unknown): T {
  if (patch === undefined || patch === null) return base;

  if (Array.isArray(base)) {
    if (!Array.isArray(patch)) return base;
    return base.map((item, index) => mergeTranslation(item, patch[index])) as unknown as T;
  }

  if (typeof base === "object") {
    if (typeof patch !== "object" || Array.isArray(patch)) return base;
    const merged: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const key of Object.keys(merged)) {
      merged[key] = mergeTranslation(merged[key], (patch as Record<string, unknown>)[key]);
    }
    return merged as T;
  }

  // Primitives: take the translation only when it is the same kind of value.
  return typeof patch === typeof base ? (patch as T) : base;
}
