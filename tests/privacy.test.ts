// The privacy claim, enforced rather than asserted (spec §18, decision 32).
//
// The landing page tells CAs their statement never leaves the device. This test
// reads the tool's own source and fails if anything in it could send data off
// the machine, or if a bank adapter has been promoted without fixtures to back
// it up. It is deliberately a source scan: a runtime test would only prove that
// the paths it happened to exercise stayed local.
//
// One thing does cross the network, and it is worth naming precisely rather
// than hiding behind the word "local": when the CA asks for AI categorisation,
// the embedding model's own weights are downloaded once from the model host by
// @huggingface/transformers, and cached by the browser. That download happens
// before any transaction is read and carries none of them. The tests below pin
// that boundary in place — the library may be imported from exactly one file,
// the message that crosses into the worker may carry only a narration, and the
// UI has to keep saying so.

import { LANGUAGES } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/translate";
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

// ---------------------------------------------------------------------------
// The AI boundary (see the note at the top of this file).
// ---------------------------------------------------------------------------

const AI_LIBRARY = "@huggingface/transformers";

describe("on-device categorisation stays on the device", () => {
  // One file, and only one, may touch the model library. It used to be the
  // worker; it is now the provider the worker loads, which is the whole point
  // of the abstraction — everything above it deals in vectors and cannot reach
  // the network even by accident.
  it("imports the model library from exactly one module", () => {
    const importers = FILES.filter((file) =>
      stripComments(readFileSync(file, "utf8")).includes(AI_LIBRARY)
    );
    expect(importers.map((file) => file.split("/").pop())).toEqual(["embeddingProvider.ts"]);
  });

  it("sends the worker a narration and a direction, and nothing else", () => {
    // If a field is added to this type it has to be justified here, in the
    // test that exists to keep amounts and account details out of it.
    const protocol = readFileSync(
      join(process.cwd(), "lib", "bankStatement", "ai", "protocol.ts"),
      "utf8"
    );
    const declaration = protocol.match(/export type AiRequestItem = \{([\s\S]*?)\};/);
    expect(declaration, "AiRequestItem is no longer declared as expected").not.toBeNull();

    const fields = (declaration as RegExpMatchArray)[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("//") && !line.startsWith("*") && !line.startsWith("/*"))
      .map((line) => line.split(/[?:]/)[0].trim());

    expect(fields.sort()).toEqual(["direction", "id", "narration"]);
  });

  it("keeps what the CA taught it out of every export", () => {
    // Learned corrections are the CA's own judgements about their client's
    // spending. They belong in this browser and in no file that leaves it.
    for (const file of [
      join(process.cwd(), "lib", "bankStatement", "export", "excel.ts"),
      join(process.cwd(), "lib", "bankStatement", "export", "pdf.ts"),
    ]) {
      expect(stripComments(readFileSync(file, "utf8"))).not.toMatch(/learned/i);
    }
  });

  // The download is a separate, explicit press, and the UI has to keep saying
  // three things about it: that it happens, that it carries none of the
  // statement, and that the CA can disconnect afterwards to see for themselves.
  // Collapsing it back into the categorise button would take the check away.
  it("keeps the model download as its own step, and says what it does", () => {
    // The copy lives in the dictionary now, so it is checked there rather than
    // by grepping the component: the panel renders these keys, and this is
    // what they have to go on saying.
    const panel = stripComments(
      readFileSync(
        join(process.cwd(), "components", "tools", "BankStatementAnalyzer", "AiCategorisationPanel.tsx"),
        "utf8"
      )
    );
    expect(panel, "no separate download control").toMatch(/bsApDownloadModel/);
    expect(panel, "does not offer the offline check").toMatch(/bsApTurnOffLabel/);

    expect(translate("en", "bsApDownloadModel")).toMatch(/download/i);
    expect(
      translate("en", "bsApOneTime"),
      "does not say the download carries none of the statement"
    ).toMatch(/sends nothing about your statement/i);
    expect(translate("en", "bsApTurnOffLabel"), "does not offer the offline check").toMatch(
      /turn your internet off/i
    );

    // And the promise has to survive translation: a CA reading in Hindi is
    // owed the same three statements, not an English fallback.
    for (const key of ["bsApDownloadModel", "bsApOneTime", "bsApTurnOffLabel"] as const) {
      for (const { code } of LANGUAGES) {
        const text = translate(code, key);
        expect(text, `${key} missing in ${code}`).toBeTruthy();
        if (code !== "en") {
          expect(text, `${key} not translated in ${code}`).not.toBe(translate("en", key));
        }
      }
    }
  });

  it("only starts the model from the two places that are allowed to", () => {
    // `start()` is what constructs the worker and pulls the model in. It may be
    // reached from the download button and from classify() — anywhere else and
    // the download would stop being something the CA chose.
    const hook = stripComments(
      readFileSync(
        join(process.cwd(), "components", "tools", "BankStatementAnalyzer", "useAiCategorisation.ts"),
        "utf8"
      )
    );
    const starts = hook.match(/\.start\(/g) ?? [];
    expect(starts.length).toBe(1);
  });
});
