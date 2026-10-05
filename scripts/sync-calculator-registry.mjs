#!/usr/bin/env node
// Regenerates components/calculators/tools/registry.ts from the English
// calculator pages, so the localized route can reach the same tool components.
//
//   node scripts/sync-calculator-registry.mjs           rewrite the file
//   node scripts/sync-calculator-registry.mjs --check    fail if it is stale
//
// The --check form runs in the build. A calculator added under
// app/calculators/<slug> without regenerating would otherwise be live in
// English and missing in every other language, which is the sort of gap that
// only shows up in search rankings weeks later.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PAGES_DIR = path.join(ROOT, "app", "calculators");
const OUT = path.join(ROOT, "components", "calculators", "tools", "registry.ts");

const HEADER = `import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * The interactive part of each calculator page, by slug.
 *
 * The English pages under app/calculators/<slug> each import their own tool, so
 * a localized route — one file serving every slug in every language — needs a
 * way to reach the same components. Generated from those pages by
 * scripts/sync-calculator-registry.mjs rather than kept by hand, so a new
 * calculator cannot be added to the English site and quietly go missing here.
 *
 * The imports are lazy so that a page still ships only the calculator it
 * renders. A plain map of static imports would pull all twenty-nine into the
 * bundle of every calculator page, on a site whose readers are largely on
 * phones.
 */
export const CALCULATOR_TOOLS: Record<string, ComponentType> = {
`;

function collect() {
  const rows = [];
  for (const entry of fs.readdirSync(PAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(PAGES_DIR, entry.name, "page.tsx");
    if (!fs.existsSync(file)) continue;

    const src = fs.readFileSync(file, "utf8");
    const used = src.match(/<([A-Z]\w*Tool)\b/);
    if (!used) {
      throw new Error(`${entry.name}: no <...Tool> component found in page.tsx`);
    }
    const component = used[1];
    const imported = src.match(
      new RegExp(String.raw`import \{\s*${component}\s*\} from "([^"]+)"`),
    );
    if (!imported) {
      throw new Error(`${entry.name}: ${component} is used but not imported by name`);
    }
    rows.push({ slug: entry.name, component, from: imported[1] });
  }
  rows.sort((a, b) => a.slug.localeCompare(b.slug));
  return rows;
}

function render(rows) {
  const body = rows
    .map(
      ({ slug, component, from }) =>
        `  "${slug}": dynamic(() => import("${from}").then((m) => m.${component})),`,
    )
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
      "sync-calculator-registry: components/calculators/tools/registry.ts is out of date.\n" +
        "Run `node scripts/sync-calculator-registry.mjs` and commit the result.",
    );
    process.exit(1);
  }
  console.log(`sync-calculator-registry: registry matches ${rows.length} calculator pages.`);
} else {
  fs.writeFileSync(OUT, next);
  console.log(`sync-calculator-registry: wrote ${rows.length} calculators to registry.ts`);
}
