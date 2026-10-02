import { getTeamMember, FINANCE_AUTHOR_SLUG, type ToolItem } from "@/lib/content";
import type { LanguageCode } from "@/lib/i18n/config";
import { itemPathFor } from "@/lib/i18n/pages";
import { toolApplicationSchema } from "@/lib/schema";

/**
 * Emits WebApplication JSON-LD for a tool page, from the same content item the
 * page renders, so the name and description never drift from the tools listing.
 *
 * It takes the item rather than looking it up by slug because a localized page
 * has to describe itself: the name, the description and the url all belong to
 * the language being served, or sixteen translated pages publish a block
 * pointing at the English one.
 */
export function ToolSchema({ item, lang = "en" }: { item: ToolItem; lang?: LanguageCode }) {
  const schema = toolApplicationSchema({
    name: item.name,
    description: item.shortDescription,
    path: itemPathFor("tools", item.slug, lang),
    author: getTeamMember(FINANCE_AUTHOR_SLUG),
  });

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
  );
}
