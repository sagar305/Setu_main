// The demo statement is quoted on the landing page (247 transactions,
// ₹18,42,000 in, ₹15,76,500 out). If the generator drifts, the marketing copy
// becomes untrue — so the published figures are pinned here.

import { describe, expect, it } from "vitest";
import { buildDemoData, DEMO_TOTALS } from "@/lib/bankStatement/demo/sampleStatement";
import { checkBalanceChain, parseStatusFrom } from "@/lib/bankStatement/normalization/validation";
import { round2 } from "@/lib/bankStatement/utils/numbers";

describe("demo statement", () => {
  const { statement, transactions } = buildDemoData();

  it("matches the figures published on the landing page", () => {
    expect(transactions).toHaveLength(DEMO_TOTALS.count);
    expect(round2(transactions.reduce((sum, t) => sum + t.credit, 0))).toBe(DEMO_TOTALS.credits);
    expect(round2(transactions.reduce((sum, t) => sum + t.debit, 0))).toBe(DEMO_TOTALS.debits);
  });

  it("has a running balance that reconciles, like a real statement", () => {
    const chain = checkBalanceChain(transactions, statement.openingBalance);
    expect(chain.checked).toBe(true);
    expect(chain.breaks).toBe(0);
    expect(chain.openingMatches).toBe(true);
    expect(statement.closingBalance).toBe(transactions[transactions.length - 1].balance);
    expect(parseStatusFrom(statement.validation)).toBe("VALID");
  });

  it("is deterministic, so the demo is identical on every machine", () => {
    const again = buildDemoData();
    expect(again.transactions.map((t) => `${t.date}|${t.debit}|${t.credit}`)).toEqual(
      transactions.map((t) => `${t.date}|${t.debit}|${t.credit}`)
    );
  });

  it("carries no positive-and-negative or zero-value rows", () => {
    for (const transaction of transactions) {
      expect(transaction.debit).toBeGreaterThanOrEqual(0);
      expect(transaction.credit).toBeGreaterThanOrEqual(0);
      expect(transaction.debit + transaction.credit).toBeGreaterThan(0);
      expect(transaction.debit > 0 && transaction.credit > 0).toBe(false);
    }
  });

  it("is labelled as synthetic, with no real-looking account number", () => {
    expect(statement.bankName).toContain("synthetic");
    expect(statement.accountNumberMasked).toMatch(/^•+\d{4}$/);
  });

  it("covers the categories a CA would expect to exercise", () => {
    const narrations = transactions.map((t) => t.narration).join(" ");
    for (const keyword of [
      "SALARY", "RENT", "ELECTRICITY", "BROADBAND", "GOOGLE ADS", "PURCHASE",
      "BANK CHARGE", "GST PAYMENT", "CASH DEPOSIT", "ATM WDL", "CREDIT CARD PAYMENT",
      "MUTUAL FUND", "PERSONAL", "INTEREST",
    ]) {
      expect(narrations).toContain(keyword);
    }
  });
});
