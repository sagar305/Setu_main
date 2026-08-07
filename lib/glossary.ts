// Client-safe glossary helpers, types and the auto-linking engine.
//
// Mirrors lib/blog.ts: no "server-only" marker here, so client components can
// import the types and URL builders. The filesystem-backed loaders live in
// lib/content.ts and re-export everything below.
//
// The auto-linker is the reason this file is pure: the same matcher runs over
// blog HTML (string in, string out) and over the plain-text paragraphs on
// calculator pages (string in, segments out), so both surfaces link the same
// vocabulary the same way.

export type GlossaryFaqItem = { question: string; answer: string };
export type GlossaryToolRef = { type: "tool" | "calculator"; slug: string };

export type GlossaryCategory = {
  id: string;
  name: string;
  description: string;
};

export type GlossaryTermSummary = {
  slug: string;
  term: string;
  category: string;
  /** One-line definition used on cards, tooltips and list rows. */
  short: string;
  /** Extra spellings the auto-linker should also match (plurals, acronyms). */
  aliases?: string[];
};

export type GlossaryTerm = GlossaryTermSummary & {
  seoTitle: string;
  metaDescription: string;
  updated?: string;
  /** Full opening definition, rendered as the answer block under the H1. */
  definition: string;
  /** Optional formula card. */
  formula?: { expression: string; note?: string };
  /** Optional worked example, plain paragraphs. */
  example?: string[];
  /** Body sections rendered after the definition. */
  bodyHtml: string;
  faq: GlossaryFaqItem[];
  relatedTools: GlossaryToolRef[];
  relatedTerms: string[];
};

export type GlossaryIndex = {
  seo: { title: string; description: string; keywords: string[] };
  hero: { eyebrow: string; headline: string; subheadline: string };
  categories: GlossaryCategory[];
  terms: GlossaryTermSummary[];
};

export type GlossaryToolLink = {
  type: "tool" | "calculator";
  slug: string;
  name: string;
  description: string;
  href: string;
};

export const GLOSSARY_BASE_PATH = "/glossary";

export function getGlossaryTermUrl(slug: string): string {
  return `${GLOSSARY_BASE_PATH}/${slug}`;
}

/** First letter a term is filed under on the A–Z index; digits bucket into "#". */
export function glossaryInitial(term: string): string {
  const first = term.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

// ---------------------------------------------------------------------------
// Auto-linking
//
// Every phrase a term should be recognised by is compiled into one regex. The
// longest phrase wins, so "input tax credit" is never matched as "tax" first.
// ---------------------------------------------------------------------------

export type GlossaryMatcher = {
  pattern: RegExp;
  /** lowercased phrase -> term slug */
  bySlug: Map<string, string>;
  phraseToSlug: Map<string, string>;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Phrases a single term should be linked on: the term itself, its aliases, and
 * a naive plural for multi-word or lowercase phrases. Acronyms (all caps) are
 * left alone so "GST" never matches "GSTs".
 */
function phrasesFor(entry: GlossaryTermSummary): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (phrase: string) => {
    const trimmed = phrase.trim();
    if (trimmed.length < 3) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(trimmed);
  };

  const base = [entry.term, ...(entry.aliases ?? [])];
  for (const phrase of base) {
    add(phrase);
    const lastWord = phrase.split(/\s+/).pop() ?? "";
    const isAcronym = /^[A-Z0-9&/-]+$/.test(lastWord);
    if (!isAcronym && !/s$/i.test(lastWord) && /^[A-Za-z]+$/.test(lastWord)) {
      add(`${phrase}s`);
    }
  }

  return out;
}

export function buildGlossaryMatcher(entries: GlossaryTermSummary[]): GlossaryMatcher {
  const phraseToSlug = new Map<string, string>();
  const bySlug = new Map<string, string>();

  for (const entry of entries) {
    bySlug.set(entry.slug, entry.term);
    for (const phrase of phrasesFor(entry)) {
      const key = phrase.toLowerCase();
      // First writer wins so a term never steals another term's exact name.
      if (!phraseToSlug.has(key)) phraseToSlug.set(key, entry.slug);
    }
  }

  const phrases = Array.from(phraseToSlug.keys()).sort((a, b) => b.length - a.length);

  // \b is unreliable around "&", "%" and "/", so the boundaries are explicit.
  const pattern = new RegExp(
    `(?<![A-Za-z0-9])(${phrases.map(escapeRegExp).join("|")})(?![A-Za-z0-9])`,
    "gi",
  );

  return { pattern, bySlug, phraseToSlug };
}

export type GlossaryLinkState = {
  used: Set<string>;
  remaining: number;
};

export function createGlossaryLinkState(maxLinks = 14, excludeSlugs: string[] = []): GlossaryLinkState {
  return { used: new Set(excludeSlugs), remaining: maxLinks };
}

export type GlossarySegment =
  | { type: "text"; value: string }
  | { type: "link"; value: string; slug: string };

/**
 * Split a run of text into plain and linkable segments. Each term is linked at
 * most once per page (tracked in `state`), which keeps articles readable and
 * avoids the keyword-stuffed look of linking every occurrence.
 */
export function segmentGlossaryText(
  text: string,
  matcher: GlossaryMatcher,
  state: GlossaryLinkState,
): GlossarySegment[] {
  if (state.remaining <= 0 || !text.trim()) return [{ type: "text", value: text }];

  const segments: GlossarySegment[] = [];
  let cursor = 0;

  matcher.pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = matcher.pattern.exec(text)) !== null) {
    if (state.remaining <= 0) break;

    const matched = match[1];
    const slug = matcher.phraseToSlug.get(matched.toLowerCase());
    if (!slug || state.used.has(slug)) continue;

    state.used.add(slug);
    state.remaining -= 1;

    if (match.index > cursor) {
      segments.push({ type: "text", value: text.slice(cursor, match.index) });
    }
    segments.push({ type: "link", value: matched, slug });
    cursor = match.index + matched.length;
  }

  if (segments.length === 0) return [{ type: "text", value: text }];
  if (cursor < text.length) segments.push({ type: "text", value: text.slice(cursor) });
  return segments;
}

// Elements whose text must never be rewritten: existing links, headings (they
// carry TOC ids), and code/markup containers.
const SKIP_TAGS = new Set(["a", "h1", "h2", "h3", "h4", "h5", "h6", "code", "pre", "script", "style"]);

/**
 * Inject glossary links into an HTML string. Text inside anchors, headings and
 * code blocks is left untouched, and tags themselves are never matched — the
 * input is split on tag boundaries first.
 */
export function linkGlossaryHtml(
  html: string,
  matcher: GlossaryMatcher,
  state: GlossaryLinkState,
  linkClassName = "glossary-link",
): string {
  const parts = html.split(/(<[^>]+>)/);
  let skipDepth = 0;

  return parts
    .map((part) => {
      if (part.startsWith("<")) {
        const tagMatch = part.match(/^<(\/?)([a-zA-Z][a-zA-Z0-9]*)/);
        if (tagMatch) {
          const [, closing, rawName] = tagMatch;
          const name = rawName.toLowerCase();
          if (SKIP_TAGS.has(name) && !part.endsWith("/>")) {
            if (closing) skipDepth = Math.max(0, skipDepth - 1);
            else skipDepth += 1;
          }
        }
        return part;
      }

      if (skipDepth > 0 || !part) return part;

      return segmentGlossaryText(part, matcher, state)
        .map((segment) =>
          segment.type === "link"
            ? `<a class="${linkClassName}" href="${getGlossaryTermUrl(segment.slug)}">${segment.value}</a>`
            : segment.value,
        )
        .join("");
    })
    .join("");
}
