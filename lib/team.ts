// Client-safe team types and author routing.
//
// Like lib/blog.ts, this has no "server-only" marker so both server components
// and schema builders can import it. The filesystem-backed loader lives in
// lib/content.ts.

export type TeamSocialLink = { label: string; href: string };

export type TeamMember = {
  slug: string;
  name: string;
  /** Job title, e.g. "Chief Executive Officer". */
  role: string;
  /** Qualifications, e.g. ["PhD", "B.Com"]. Empty when none are published. */
  education: string[];
  /** Path under /public, or null when no photo has been supplied yet. */
  image: string | null;
  /** Empty string until bio copy is written. */
  bio: string;
  social: TeamSocialLink[];
};

export type TeamContent = {
  seo: { title: string; description: string; keywords: string[] };
  hero: { eyebrow: string; headline: string; subheadline: string };
  members: TeamMember[];
};

/**
 * Blog categories treated as financial. Posts in these are authored by the
 * CEO; everything else is authored by the CMO.
 */
const FINANCE_CATEGORIES = new Set(["business-finance", "accounting", "compliance"]);

export const FINANCE_AUTHOR_SLUG = "suman-bansal";
export const GENERAL_AUTHOR_SLUG = "mayuri-agarwal";

/** Which team member is credited with a post in the given category. */
export function blogAuthorSlug(categorySlug: string): string {
  return FINANCE_CATEGORIES.has(categorySlug) ? FINANCE_AUTHOR_SLUG : GENERAL_AUTHOR_SLUG;
}
