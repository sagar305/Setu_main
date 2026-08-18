// Reconciliation matching (spec §17). The levels must be tried in order, each
// row consumed once, and a near miss on amount must be surfaced rather than
// quietly matched.

import { describe, expect, it } from "vitest";
import type { LedgerEntry, Transaction } from "@/lib/bankStatement/types";
import { reconcile, summarise } from "@/lib/bankStatement/reconciliation/matcher";
import { buildLedger } from "@/lib/bankStatement/reconciliation/ledgerImport";
import { parseCsv } from "@/lib/bankStatement/parser/csv";

let n = 0;
function bank(overrides: Partial<Transaction> = {}): Transaction {
  n += 1;
  return {
    id: `b${n}`,
    statementId: "s1",
    date: "2025-04-01",
    narration: "NEFT CR MERIDIAN RETAIL INV-4101",
    debit: 0,
    credit: 50000,
    currency: "INR",
    transactionType: "CREDIT",
    classificationType: "BUSINESS",
    classificationSource: "HEURISTIC",
    createdAt: "2025-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function book(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  n += 1;
  return {
    id: `k${n}`,
    date: "2025-04-01",
    narration: "Meridian Retail invoice 4101",
    debit: 0,
    credit: 50000,
    ...overrides,
  };
}

describe("reconcile", () => {
  it("matches exactly on date, amount and reference", () => {
    const matches = reconcile(
      [bank({ referenceNumber: "N012345678" })],
      [book({ reference: "N012345678" })]
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].status).toBe("MATCHED");
    expect(matches[0].level).toBe(1);
  });

  it("matches within a two-day window and calls it likely, not certain", () => {
    const matches = reconcile([bank({ date: "2025-04-01" })], [book({ date: "2025-04-03" })]);
    expect(matches[0].status).toBe("LIKELY_MATCH");
    expect(matches[0].level).toBe(2);
  });

  it("falls back to narration similarity inside three days", () => {
    const matches = reconcile(
      [bank({ date: "2025-04-01", narration: "RTGS DR PURCHASE VERTEX SUPPLIES", debit: 9500, credit: 0, transactionType: "DEBIT" })],
      [book({ date: "2025-04-04", narration: "Vertex Supplies purchase bill", debit: 9500, credit: 0 })]
    );
    expect(matches[0].status).toBe("LIKELY_MATCH");
    expect(matches[0].level).toBe(3);
  });

  it("never matches a debit against a credit of the same size", () => {
    const matches = reconcile(
      [bank({ debit: 5000, credit: 0, transactionType: "DEBIT" })],
      [book({ debit: 0, credit: 5000 })]
    );
    expect(matches.map((match) => match.status).sort()).toEqual(["UNMATCHED_BANK", "UNMATCHED_BOOK"]);
  });

  it("reports a near miss on amount instead of matching it", () => {
    const matches = reconcile([bank({ credit: 50000 })], [book({ credit: 49500 })]);
    expect(matches[0].status).toBe("AMOUNT_MISMATCH");
    expect(matches[0].difference).toBe(500);
  });

  it("consumes each entry once", () => {
    const matches = reconcile(
      [bank({ id: "b-a" }), bank({ id: "b-b" })],
      [book({ id: "k-a" })]
    );
    const matched = matches.filter((match) => match.ledgerEntryId === "k-a");
    expect(matched).toHaveLength(1);
    expect(matches.filter((match) => match.status === "UNMATCHED_BANK")).toHaveLength(1);
  });

  it("leaves both sides unmatched when nothing lines up", () => {
    const matches = reconcile(
      [bank({ date: "2025-04-01", credit: 1000 })],
      [book({ date: "2025-06-01", credit: 7777 })]
    );
    expect(matches.map((match) => match.status).sort()).toEqual(["UNMATCHED_BANK", "UNMATCHED_BOOK"]);
  });

  it("summarises the difference between the two sides", () => {
    const transactions = [bank({ credit: 50000 }), bank({ debit: 18000, credit: 0, transactionType: "DEBIT" })];
    const entries = [book({ credit: 50000 })];
    const summary = summarise(reconcile(transactions, entries), transactions, entries);
    expect(summary.bankTotal).toBe(32000);
    expect(summary.bookTotal).toBe(50000);
    expect(summary.difference).toBe(-18000);
    expect(summary.unmatchedBank).toBe(1);
  });
});

describe("ledger import", () => {
  it("maps any column layout, not a fixed template", () => {
    const csv = [
      "Voucher Date|Particulars|Vch No|Debit|Credit",
      "01/04/2025|Meridian Retail invoice|V-101||50000.00",
      "10/04/2025|Office rent April|V-102|18000.00|",
    ].join("\n");

    const { entries, mapping, skipped } = buildLedger(parseCsv(csv));
    expect(skipped).toBe(0);
    expect(entries).toHaveLength(2);
    expect(mapping.narration).toBe(1);
    expect(entries[0]).toMatchObject({ date: "2025-04-01", credit: 50000, debit: 0 });
    expect(entries[1]).toMatchObject({ date: "2025-04-10", debit: 18000, credit: 0 });
  });

  it("counts rows it could not read rather than dropping them silently", () => {
    const csv = ["Date,Narration,Debit,Credit", "not-a-date,Broken row,,100", "01/04/2025,Good row,,100"].join("\n");
    const { entries, skipped } = buildLedger(parseCsv(csv));
    expect(entries).toHaveLength(1);
    expect(skipped).toBe(1);
  });
});
