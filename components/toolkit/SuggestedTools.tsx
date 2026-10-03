// Registry-driven "Suggested tools" links (Tool Discovery, spec §10).
// Server-renderable: the registry is plain data.

import Link from "next/link";
import { suggestedTools, type ToolSlug } from "@/lib/toolkit/registry";
import type { LanguageCode } from "@/lib/i18n/config";
import { localizedHref } from "@/lib/i18n/pages";

/**
 * `lang` is the language of the page the strip sits on. The registry stores one
 * English route per tool, so without it this strip was the way out of a
 * translated visit: a reader on /hi/tools/cash-book tapped a suggestion and
 * landed on the English tool. A tool not yet translated keeps its English path.
 */
export function SuggestedTools({ current, lang = "en" }: { current: string; lang?: LanguageCode }) {
  // A slug the toolkit registry does not know simply has no integrations, so
  // the cast cannot produce a wrong answer — only an empty strip.
  const tools = suggestedTools(current as ToolSlug).filter(
    (t) => t.route && t.status === "built",
  );
  if (tools.length === 0) return null;
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold text-ink">Related Tools</h2>
      <div className="flex flex-wrap gap-3">
        {tools.map((tool) => (
          <Link
            key={tool.slug}
            href={localizedHref(tool.route!, lang)}
            className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
          >
            {tool.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
