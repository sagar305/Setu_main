// The privacy claim, enforced rather than asserted (spec §18, decision 32).
//
// The landing page tells CAs their statement never leaves the device. This test
// reads the tool's own source and fails if anything in it could send data off
// the machine, or if a bank adapter has been promoted without fixtures to back
// it up. It is deliberately a source scan: a runtime test would only prove that
// the paths it happened to exercise stayed local.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BANK_ADAPTERS } from "@/lib/bankStatement/parser/banks";

/** Strip comments so the scans test code, not the prose describing it. */
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

const FILES = [
  ...sourceFiles(join(process.cwd(), "lib", "bankStatement")),
  ...sourceFiles(join(process.cwd(), "components", "tools", "BankStatementAnalyzer")),
];

describe("privacy", () => {
  it("has source to scan", () => {
    expect(FILES.length).toBeGreaterThan(20);
  });

  it("contains no network calls anywhere in the analyzer", () => {
    const offenders: string[] = [];
    // `new URL(..., import.meta.url)` is a bundler asset reference, not a
    // request, so the worker path in pdf.ts is not a network call.
    const banned = /\b(fetch|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon|axios)\b/;

    for (const file of FILES) {
      const source = stripComments(readFileSync(file, "utf8"));
      for (const [index, line] of source.split("\n").entries()) {
        if (banned.test(line)) offenders.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("uses no analytics or error-reporting SDK", () => {
    const banned = /\b(gtag|dataLayer|Sentry|posthog|mixpanel|amplitude|plausible|analytics)\b/i;
    const offenders = FILES.filter((file) => banned.test(stripComments(readFileSync(file, "utf8"))));
    expect(offenders).toEqual([]);
  });

  it("never renders statement text as raw HTML", () => {
    const offenders = FILES.filter((file) =>
      stripComments(readFileSync(file, "utf8")).includes("dangerouslySetInnerHTML")
    );
    expect(offenders).toEqual([]);
  });

  it("never evaluates code from an imported file", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const source = stripComments(readFileSync(file, "utf8"));
      for (const [index, line] of source.split("\n").entries()) {
        if (/\beval\s*\(|new\s+Function\s*\(/.test(line)) {
          offenders.push(`${file}:${index + 1}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the PDF password out of the persistence layer entirely", () => {
    // The password travels as a parse option and dies with the call. Nothing in
    // the storage layer may so much as name it.
    for (const file of ["store.ts", "db.ts"]) {
      const source = stripComments(
        readFileSync(join(process.cwd(), "lib", "bankStatement", "storage", file), "utf8")
      );
      expect(source, `${file} references a password`).not.toMatch(/password/i);
    }
  });
});

describe("bank adapters stay honest", () => {
  // Decision 11 / spec §30: an adapter may only claim it supports a bank once
  // it has passed the golden tests against anonymised fixtures for that bank.
  // Until then it must stay validated: false, and the tool tells the CA so.
  it("declares every unfixtured bank adapter unvalidated", () => {
    const fixtures = readdirSync(join(process.cwd(), "tests", "fixtures")).filter((entry) =>
      statSync(join(process.cwd(), "tests", "fixtures", entry)).isDirectory()
    );

    for (const adapter of BANK_ADAPTERS) {
      if (adapter.validated) {
        expect(
          fixtures,
          `${adapter.id} is marked validated but has no tests/fixtures/${adapter.id}/ directory`
        ).toContain(adapter.id);
      }
    }
  });
});
