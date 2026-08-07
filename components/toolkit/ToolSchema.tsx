import { getToolBySlug, getTeamMember, FINANCE_AUTHOR_SLUG } from "@/lib/content";
import { toolApplicationSchema } from "@/lib/schema";

/**
 * Emits WebApplication JSON-LD for a tool page, sourced from tools.json so the
 * name and description never drift from the tools listing. Renders nothing if
 * the slug has no entry.
 */
export function ToolSchema({ slug }: { slug: string }) {
  const tool = getToolBySlug(slug);
  if (!tool) return null;

  const schema = toolApplicationSchema({
    name: tool.name,
    description: tool.shortDescription,
    path: `/tools/${slug}`,
    author: getTeamMember(FINANCE_AUTHOR_SLUG),
  });

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
  );
}
