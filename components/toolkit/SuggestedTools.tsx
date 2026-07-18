// Registry-driven "Suggested tools" links (Tool Discovery, spec §10).
// Server-renderable: the registry is plain data.

import Link from "next/link";
import { suggestedTools, type ToolSlug } from "@/lib/toolkit/registry";

export function SuggestedTools({ current }: { current: ToolSlug }) {
  const tools = suggestedTools(current).filter((t) => t.route && t.status === "built");
  if (tools.length === 0) return null;
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold text-ink">Related Tools</h2>
      <div className="flex flex-wrap gap-3">
        {tools.map((tool) => (
          <Link
            key={tool.slug}
            href={tool.route!}
            className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
          >
            {tool.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
