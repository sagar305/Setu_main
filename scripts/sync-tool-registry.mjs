#!/usr/bin/env node
// Regenerates components/tools/registry.tsx from the English tool pages, so the
// localized route can reach the same tool components.
//
//   node scripts/sync-tool-registry.mjs           rewrite the file
//   node scripts/sync-tool-registry.mjs --check    fail if it is stale
//
// The --check form runs in the build. A tool added under app/tools/<slug>
// without regenerating would otherwise be live in English and missing in every
// other language — the sort of gap that only shows up in search rankings weeks
// later.
//
// Unlike the calculators, several tools share one component and tell it apart by
// a prop (<DocumentTool docType="credit-note" />, <AgingReportTool
// kind="payable" />), so those entries wrap the component to bind its prop. The
// wrapper is written with createElement rather than JSX, which keeps the
// generated file a plain .ts that any tool can parse.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PAGES_DIR = path.join(ROOT, "app", "tools");
const OUT = path.join(ROOT, "components", "tools", "registry.ts");

const HEADER = `import dynamic from "next/dynamic";
import { createElement, type ComponentType } from "react";

/** One tool page, as the localized route needs to render it. */
export type ToolPageEntry = {
  /** The interactive part of the page. */
  Tool: ComponentType;
  /** Whether this page publishes the SoftwareApplication block. */
  schema: boolean;
  /** Whether this page shows the suggested-tools strip. */
  suggested: boolean;
  /**
   * Whether the tool needs its own Suspense boundary. A couple read search
   * params, which a statically rendered route cannot do unboundaried.
   */
  suspense: boolean;
};

/**
 * Every tool page, by slug.
 *
 * The English pages under app/tools/<slug> each import their own tool and say
 * which extra blocks they show, so a localized route — one file serving every
 * slug in every language — needs a way to reach the same components and make
 * the same choices. Generated from those pages by
 * scripts/sync-tool-registry.mjs rather than kept by hand, so a new tool cannot
 * be added to the English site and quietly go missing here, and the two routes
 * cannot drift apart over which blocks a page carries.
 *
 * The imports are lazy so that a page still ships only the tool it renders. A
 * plain map of static imports would pull all thirty-five into the bundle of
 * every tool page, on a site whose readers are largely on phones.
 */
export const TOOL_PAGES: Record<string, ToolPageEntry> = {
`;

/** The props a page passes its tool, as written: kind="payable" etc. */
function literalProps(source) {
  const props = {};
  for (const match of source.matchAll(/([a-zA-Z][\w]*)="([^"]*)"/g)) {
    props[match[1]] = match[2];
  }
  return props;
}

function collect() {
  const rows = [];
  for (const entry of fs.readdirSync(PAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(PAGES_DIR, entry.name, "page.tsx");
    if (!fs.existsSync(file)) continue;

    const src = fs.readFileSync(file, "utf8");
    const used = src.match(/<([A-Z]\w*Tool)\b([^>]*?)\/?>/);
    if (!used) {
      throw new Error(`${entry.name}: no <...Tool> component found in page.tsx`);
    }
    const [, component, rawProps] = used;
    const imported = src.match(
      new RegExp(String.raw`import \{\s*${component}\s*\} from "([^"]+)"`),
    );
    if (!imported) {
      throw new Error(`${entry.name}: ${component} is used but not imported by name`);
    }
    rows.push({
      slug: entry.name,
      component,
      from: imported[1],
      props: literalProps(rawProps ?? ""),
      // The English page declares these on <ToolPageShell>; reading them here
      // is what keeps the localized route showing the same blocks.
      schema: /<ToolPageShell[\s\S]*?\bschema\b[\s\S]*?>/.test(src),
      suggested: /<ToolPageShell[\s\S]*?\bsuggested\b[\s\S]*?>/.test(src),
      suspense: src.includes("<Suspense"),
    });
  }
  rows.sort((a, b) => a.slug.localeCompare(b.slug));
  return rows;
}

/** credit-note-generator -> CreditNoteGenerator, for the wrapper's name. */
function pascal(slug) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function render(rows) {
  const body = rows
    .map(({ slug, component, from, props, schema, suggested, suspense }) => {
      const entries = Object.entries(props);
      const flags = `schema: ${schema}, suggested: ${suggested}, suspense: ${suspense}`;

      if (entries.length === 0) {
        return (
          `  "${slug}": {\n` +
          `    Tool: dynamic(() => import("${from}").then((m) => m.${component})),\n` +
          `    ${flags},\n` +
          `  },`
        );
      }
      // The props are part of which tool this slug is, so they are baked into a
      // named wrapper rather than left for every caller to remember.
      const attrs = entries
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join(", ");
      return (
        `  "${slug}": {\n` +
        `    Tool: dynamic(async () => {\n` +
        `      const { ${component} } = await import("${from}");\n` +
        `      return function ${pascal(slug)}() {\n` +
        `        return createElement(${component}, { ${attrs} });\n` +
        `      };\n` +
        `    }),\n` +
        `    ${flags},\n` +
        `  },`
      );
    })
    .join("\n");
  return `${HEADER}${body}\n};\n`;
}

const rows = collect();
const next = render(rows);
const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";

// The checked-in file is Prettier-formatted and this script does not
// reimplement Prettier, so compare on content alone: drop whitespace, and drop
// the trailing commas Prettier adds to the arguments it wraps onto own lines.
const squash = (s) => s.replace(/\s+/g, "").replace(/,(?=[)\]}])/g, "");

if (process.argv.includes("--check")) {
  if (squash(current) !== squash(next)) {
    console.error(
      "sync-tool-registry: components/tools/registry.ts is out of date.\n" +
        "Run `node scripts/sync-tool-registry.mjs` and commit the result.",
    );
    process.exit(1);
  }
  console.log(`sync-tool-registry: registry matches ${rows.length} tool pages.`);
} else {
  fs.writeFileSync(OUT, next);
  console.log(`sync-tool-registry: wrote ${rows.length} tools to registry.ts`);
}
