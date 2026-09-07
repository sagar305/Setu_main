// The line analytics is not allowed to cross.
//
// tests/privacy.test.ts already forbids any analytics SDK inside the bank
// statement analyzer. The pipeline added alongside it makes two more promises
// that are only worth making if something enforces them:
//
//   - the offline products stay uninstrumented from the inside, so the tools
//     that hold a visitor's actual work have no path to a network call that
//     was added for measurement;
//   - the click listener reads names developers wrote, never content a visitor
//     typed. That distinction is the whole reason the privacy page can say
//     what it says.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) found.push(full);
  }
  return found;
}

/**
 * The trees holding a visitor's own work.
 *
 * These are instrumented from their page wrappers if at all, never from
 * inside. A network ban would be wrong here — several of them legitimately
 * sync to a Google Sheet the owner connected — so what is banned is the
 * analytics import specifically.
 */
const OFFLINE_PRODUCTS = [
  ["lib", "bankStatement"],
  ["lib", "pos"],
  ["lib", "token"],
  ["lib", "clinic"],
  ["lib", "rental"],
  ["lib", "dine"],
  ["lib", "tuition"],
  ["components", "tools", "BankStatementAnalyzer"],
];

describe("the offline products are not instrumented from the inside", () => {
  const banned = /@\/lib\/analytics|\btrackEvent\b|\bgtag\b|\bdataLayer\b|posthog/i;

  for (const segments of OFFLINE_PRODUCTS) {
    const relative = segments.join("/");
    const directory = join(process.cwd(), ...segments);

    it(`keeps analytics out of ${relative}`, () => {
      let files: string[];
      try {
        files = sourceFiles(directory);
      } catch {
        // A product that has not been built yet cannot violate anything.
        return;
      }

      const offenders = files.filter((file) => banned.test(stripComments(readFileSync(file, "utf8"))));
      expect(offenders, `${relative} imports analytics`).toEqual([]);
    });
  }
});

describe("the click listener reads labels, not content", () => {
  const PIPELINE = sourceFiles(join(process.cwd(), "lib", "analytics")).concat(
    sourceFiles(join(process.cwd(), "components", "analytics"))
  );

  it("has source to scan", () => {
    expect(PIPELINE.length).toBeGreaterThan(4);
  });

  it("never reads text or values out of the page", () => {
    // `.value` would capture what was typed; `textContent` and `innerText`
    // would capture a calculator's result or a POS line item, both of which are
    // text sitting inside a clickable element.
    const banned = /\.(value|textContent|innerText|innerHTML|outerHTML)\b/;
    const offenders: string[] = [];

    for (const file of PIPELINE) {
      const source = stripComments(readFileSync(file, "utf8"));
      for (const [index, line] of source.split("\n").entries()) {
        // `attribute.value` is the declared data-analytics-* label, which is
        // written by us and is the one thing the listener is allowed to read.
        if (/\battribute\.value\b/.test(line)) continue;
        if (banned.test(line)) offenders.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never sends a query string or a URL fragment", () => {
    // /menu and /view carry an entire document in the fragment, so a link's
    // href may only ever be reported as origin plus pathname.
    const provider = stripComments(
      readFileSync(join(process.cwd(), "components", "analytics", "AnalyticsProvider.tsx"), "utf8")
    );
    expect(provider).toMatch(/url\.origin\}\$\{url\.pathname/);
    expect(provider).not.toMatch(/url\.(search|hash)\b/);
  });
});
