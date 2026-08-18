// The ruled-table PDF: the layout that a real statement taught us about.
// ---------------------------------------------------------------------------
// Each assertion here maps to a bug that shipped and had to be fixed. See
// tests/fixtures/generic/make-ruled-statement-pdf.mjs for what the fixture
// deliberately reproduces.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { parseStatementFile } from "@/lib/bankStatement/parser";
import type { ParseOutcome } from "@/lib/bankStatement/types";
import { round2 } from "@/lib/bankStatement/utils/numbers";

const FIXTURES = join(process.cwd(), "tests", "fixtures", "generic");
const expected = JSON.parse(
  readFileSync(join(FIXTURES, "statement-05-ruled.expected.json"), "utf8")
);

let outcome: ParseOutcome;

beforeAll(async () => {
  // PDF.js resolves its worker relative to the bundle in the browser; in Node
  // we point it at the real file first, which the loader deliberately respects.
  const require = createRequire(import.meta.url);
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as {
    GlobalWorkerOptions: { workerSrc: string };
  };
  pdfjs.GlobalWorkerOptions.workerSrc = require.resolve(
    "pdfjs-dist/legacy/build/pdf.worker.mjs"
  );

  const bytes = readFileSync(join(FIXTURES, "statement-05-ruled.pdf"));
  outcome = await parseStatementFile(
    new File([bytes], "statement-05-ruled.pdf", { type: "application/pdf" })
  );
}, 60_000);

describe("ruled-table PDF", () => {
  it("extracts every transaction across every page", () => {
    expect(outcome.transactions).toHaveLength(expected.transactionCount);
    expect(outcome.statement.parseStatus).toBe(expected.parseStatus);
    expect(outcome.statement.validation.unresolved).toBe(0);
  });

  // Row bands are per page. Reusing page 1's bands silently dropped every row
  // that fell outside them once the letterhead was gone.
  it("keeps rows on later pages, where the table starts higher", () => {
    const pages = new Set(outcome.transactions.map((t) => t.sourcePage));
    expect(pages.size).toBe(expected.pages);
    for (const page of pages) {
      expect(outcome.transactions.filter((t) => t.sourcePage === page).length).toBeGreaterThan(0);
    }
  });

  it("reconciles against the statement's own running balance", () => {
    const chain = outcome.statement.validation.balanceChain;
    expect(chain.checked).toBe(true);
    expect(chain.breaks).toBe(expected.balanceBreaks);
    expect(chain.openingMatches).toBe(true);
    expect(chain.closingMatches).toBe(true);
  });

  it("totals to the rupee", () => {
    expect(round2(outcome.transactions.reduce((sum, t) => sum + t.debit, 0))).toBe(
      expected.totalDebits
    );
    expect(round2(outcome.transactions.reduce((sum, t) => sum + t.credit, 0))).toBe(
      expected.totalCredits
    );
  });

  it("maps all eight columns from a header stacked across baselines", () => {
    expect(outcome.mapping).toMatchObject(expected.mapping);
  });

  // "01 Dec" sits above "2025" in a narrow column; grouping by baseline alone
  // tore every transaction into three unusable fragments.
  it("reassembles a date wrapped onto two lines", () => {
    expect(outcome.transactions[0]).toMatchObject(expected.firstTransaction);
    for (const transaction of outcome.transactions) {
      expect(transaction.date).toMatch(/^2025-12-\d{2}$/);
    }
  });

  // The header repeats on every page. Left in, it has no date and no amount,
  // so it looked like wrapped narration and was glued onto the previous row.
  it("drops the repeated page header instead of appending it to a narration", () => {
    for (const transaction of outcome.transactions) {
      expect(transaction.narration).not.toMatch(/Description|Branch Code|Txn Date/);
    }
  });

  // A balance-only row moved no money — it is not a failed extraction.
  it("reads the opening and closing balance markers without erroring", () => {
    expect(outcome.statement.openingBalance).toBe(expected.openingBalance);
    expect(outcome.statement.closingBalance).toBe(expected.closingBalance);
    expect(outcome.statement.validation.skippedRows).toBe(expected.skippedRows);
    expect(
      outcome.statement.validation.issues.filter((issue) => issue.severity === "error")
    ).toEqual([]);
  });

  // A branch code is a short integer. Inferred as an amount, it became the
  // debit column and every real debit shifted into credit.
  it("never mistakes the numeric branch code for money", () => {
    expect(outcome.mapping?.debit).not.toBe(4);
    expect(outcome.mapping?.credit).not.toBe(4);
    expect(outcome.mapping?.amount).toBeUndefined();
  });

  // PDF.js fuses adjacent cells into one run; the column rules are what make
  // the split possible. A fused row would show a branch code inside an amount.
  it("splits cells that PDF.js fused into a single text run", () => {
    for (const transaction of outcome.transactions) {
      expect(Number.isFinite(transaction.debit)).toBe(true);
      expect(Number.isFinite(transaction.credit)).toBe(true);
      expect(transaction.debit < 1_000_000).toBe(true);
      expect(transaction.credit < 1_000_000).toBe(true);
    }
  });
});
