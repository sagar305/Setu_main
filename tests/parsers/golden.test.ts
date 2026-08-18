// Golden fixture tests (spec §29).
// ---------------------------------------------------------------------------
// Each fixture has an expected-output file recording what a parse MUST produce.
// This harness exists before any bank adapter is promoted: an adapter is only
// allowed to claim it supports a bank once it passes these tests against real
// anonymised statements for that bank. See tests/fixtures/README.md.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseStatementFile } from "@/lib/bankStatement/parser";
import { round2 } from "@/lib/bankStatement/utils/numbers";

const FIXTURES = join(process.cwd(), "tests", "fixtures");

type Expected = {
  transactionCount: number;
  openingBalance?: number;
  closingBalance?: number;
  totalDebits?: number;
  totalCredits?: number;
  parseStatus?: string;
  balanceBreaks?: number;
  startDate?: string;
  endDate?: string;
  firstBreakOn?: string;
  firstTransaction?: Record<string, unknown>;
  lastTransaction?: Record<string, unknown>;
};

function loadFixture(bank: string, name: string): { file: File; expected: Expected } {
  const csv = readFileSync(join(FIXTURES, bank, `${name}.csv`));
  const expected = JSON.parse(
    readFileSync(join(FIXTURES, bank, `${name}.expected.json`), "utf8")
  ) as Expected;
  return {
    file: new File([csv], `${name}.csv`, { type: "text/csv" }),
    expected,
  };
}

describe("generic CSV statements", () => {
  it("parses split withdrawal/deposit columns and validates the balance chain", async () => {
    const { file, expected } = loadFixture("generic", "statement-01");
    const { statement, transactions } = await parseStatementFile(file);

    expect(transactions).toHaveLength(expected.transactionCount);
    expect(statement.parseStatus).toBe(expected.parseStatus);
    expect(statement.validation.balanceChain.breaks).toBe(expected.balanceBreaks);
    expect(statement.validation.unresolved).toBe(0);

    expect(round2(transactions.reduce((sum, t) => sum + t.debit, 0))).toBe(expected.totalDebits);
    expect(round2(transactions.reduce((sum, t) => sum + t.credit, 0))).toBe(expected.totalCredits);

    expect(statement.openingBalance).toBe(expected.openingBalance);
    expect(statement.closingBalance).toBe(expected.closingBalance);
    expect(statement.startDate).toBe(expected.startDate);
    expect(statement.endDate).toBe(expected.endDate);

    expect(transactions[0]).toMatchObject(expected.firstTransaction ?? {});
    expect(transactions[transactions.length - 1]).toMatchObject(expected.lastTransaction ?? {});
  });

  it("reads a single amount column with a Dr/Cr indicator", async () => {
    const { file, expected } = loadFixture("generic", "statement-02");
    const { statement, transactions } = await parseStatementFile(file);

    expect(transactions).toHaveLength(expected.transactionCount);
    expect(round2(transactions.reduce((sum, t) => sum + t.debit, 0))).toBe(expected.totalDebits);
    expect(round2(transactions.reduce((sum, t) => sum + t.credit, 0))).toBe(expected.totalCredits);
    expect(transactions[0]).toMatchObject(expected.firstTransaction ?? {});
    expect(statement.parseStatus).toBe(expected.parseStatus);
  });

  // The rule this whole product hangs on (§30): when the extraction does not
  // reconcile, say so — never present the rows that did parse as the full set.
  it("refuses to call a statement with a broken balance chain valid", async () => {
    const { file, expected } = loadFixture("generic", "statement-03-broken");
    const { statement, transactions } = await parseStatementFile(file);

    expect(transactions).toHaveLength(expected.transactionCount);
    expect(statement.parseStatus).toBe("UNRESOLVED");
    expect(statement.validation.balanceChain.checked).toBe(true);
    expect(statement.validation.balanceChain.breaks).toBe(expected.balanceBreaks);

    const flagged = transactions.filter((t) => t.rowIssue?.startsWith("Running balance"));
    expect(flagged).toHaveLength(1);
    expect(flagged[0].date).toBe(expected.firstBreakOn);
    expect(statement.validation.issues.some((issue) => issue.severity === "error")).toBe(true);
  });
});
