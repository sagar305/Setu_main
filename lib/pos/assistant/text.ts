// Text helpers for the POS assistant.
//
// The assistant understands a shopkeeper's typing — short, misspelt, often
// Hinglish ("2 maggi becho", "aaj ki sale") — without a language model. That
// takes three small things: a normaliser, a number reader that knows "do" and
// "teen" as well as "two" and "three", and a fuzzy matcher good enough to find
// "parle g" when the product is saved as "Parle-G Biscuit 100g".

/** Lowercase, strip punctuation that never carries meaning, squash spaces. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    // Devanagari digits (०–९) read as the numbers they are.
    .replace(/[\u0966-\u096F]/g, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{M}\p{N}.,\-+@#/ ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Like normalize, but also folds hyphens, dots and commas so "parle-g" = "parle g". */
export function foldName(text: string): string {
  return normalize(text).replace(/[-.,/]+/g, " ").replace(/\s+/g, " ").trim();
}

export function tokens(text: string): string[] {
  return foldName(text).split(" ").filter(Boolean);
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  single: 1,
  two: 2,
  pair: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  dozen: 12,
  fifteen: 15,
  twenty: 20,
  fifty: 50,
  hundred: 100,
  // Hindi, as people type it in Latin script.
  ek: 1,
  do: 2,
  teen: 3,
  char: 4,
  chaar: 4,
  paanch: 5,
  panch: 5,
  chhe: 6,
  che: 6,
  saat: 7,
  aath: 8,
  nau: 9,
  das: 10,
  bees: 20,
  pachas: 50,
  sau: 100,
};

/** Parse "12", "12.5", "₹1,200", "two" or "teen" into a number; null if not one. */
export function readNumber(word: string): number | null {
  const cleaned = word.replace(/^(rs\.?|inr|₹)/i, "").replace(/,/g, "");
  if (/^\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
  const known = NUMBER_WORDS[word.toLowerCase()];
  return known === undefined ? null : known;
}

/** Levenshtein distance, capped work for the short strings we compare. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  // "maggi" typed against "maggie", or a prefix: "bisc" for "biscuit".
  if (b.startsWith(a) && a.length >= 3) return 0.9;
  const longest = Math.max(a.length, b.length);
  return 1 - editDistance(a, b) / longest;
}

/**
 * How well a typed phrase names a saved item, 0–1.
 *
 * Every typed word has to find a home among the item's words; words the user
 * left out of a long product name cost much less than typed words that match
 * nothing. That is what lets "parle g" find "Parle-G Biscuit 100g" while
 * "parle cake" does not.
 */
export function nameScore(query: string, candidate: string): number {
  const q = foldName(query);
  const c = foldName(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;
  const qCompact = q.replace(/ /g, "");
  const cCompact = c.replace(/ /g, "");
  if (qCompact === cCompact) return 0.98;

  const qWords = q.split(" ");
  const cWords = c.split(" ");
  let matched = 0;
  for (const word of qWords) {
    let best = 0;
    for (const target of cWords) best = Math.max(best, wordSimilarity(word, target));
    // A typed word only counts when it is clearly that word, not a near miss
    // of something else; partial credit is what produces wrong matches.
    matched += best >= 0.75 ? best : 0;
  }
  const coverage = matched / qWords.length;
  const unmatchedCandidateWords = Math.max(cWords.length - qWords.length, 0);
  const lengthPenalty = Math.min(unmatchedCandidateWords * 0.04, 0.2);

  // Whole-string closeness rescues single-word typos the word pass misses.
  const whole = 1 - editDistance(qCompact, cCompact) / Math.max(qCompact.length, cCompact.length);

  return Math.max(coverage - lengthPenalty, whole);
}

export type NameMatch<T> =
  | { kind: "found"; item: T; score: number }
  | { kind: "ambiguous"; options: T[] }
  | { kind: "none" };

/**
 * Find the item a phrase names. Two candidates scoring about the same is
 * reported as ambiguous rather than guessed: the assistant asks, because
 * selling the wrong product is worse than one more question.
 */
export function matchByName<T>(
  query: string,
  items: T[],
  nameOf: (item: T) => string[],
  threshold = 0.72
): NameMatch<T> {
  const scored = items
    .map((item) => ({
      item,
      score: Math.max(0, ...nameOf(item).filter(Boolean).map((n) => nameScore(query, n))),
    }))
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { kind: "none" };
  const [first, second] = scored;
  if (first.score >= 0.98 || !second || first.score - second.score > 0.06) {
    return { kind: "found", item: first.item, score: first.score };
  }
  return {
    kind: "ambiguous",
    options: scored.filter((entry) => first.score - entry.score <= 0.06).slice(0, 4).map((e) => e.item),
  };
}

/** True when any of the words or phrases appears as a whole word in the text. */
export function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => new RegExp(`(^|\\s)${escapeRegExp(word)}(\\s|$)`).test(text));
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
