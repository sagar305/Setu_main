// Column reconstruction from positioned text runs.
// ---------------------------------------------------------------------------
// A PDF gives us no table — only strings with coordinates. These tests use
// geometry copied from real PDF.js output for the generated fixtures, so they
// pin the two layouts that matter: left-aligned columns, and the right-aligned
// amount columns that every bank actually prints.

import { describe, expect, it } from "vitest";
import {
  columnRanges,
  groupIntoLines,
  splitIntoRanges,
  type TextItem,
} from "@/lib/bankStatement/parser/pdf";

const item = (text: string, x: number, y: number, width: number): TextItem => ({
  text,
  x,
  y,
  width,
});

/**
 * A right-aligned statement: date, value date, narration, reference on the
 * left, then withdrawal / deposit / balance right-aligned at 428 / 500 / 559.
 * Note the header row's "Withdrawal Amt." overhangs the reference column —
 * that single overlapping line must not fuse the two columns.
 */
function rightAlignedPage(): TextItem[] {
  const items: TextItem[] = [
    item("Txn Date", 36, 693.9, 35.9),
    item("Value Date", 88, 693.9, 43.5),
    item("Narration", 140, 693.9, 37.8),
    item("Chq/Ref No", 340, 693.9, 46.3),
    item("Withdrawal Amt.", 361.5, 693.9, 66.6),
    item("Deposit Amt.", 447.7, 693.9, 52.4),
    item("Closing Balance", 493.1, 693.9, 66.1),
  ];

  const rows: [string, string, string, string, string][] = [
    ["NEFT DR/SALARY/RAHUL MEHTA", "S000001", "12000.00", "", "400500.00"],
    ["NEFT DR/SALARY/PRIYA NAIR", "S000002", "20500.00", "", "380000.00"],
    ["NEFT CR/MERIDIAN RETAIL PVT LTD", "S000003", "", "26500.00", "406500.00"],
    ["ACH DR/OFFICE RENT/SKYLINE", "S000004", "18000.00", "", "388500.00"],
    ["BILLPAY/ELECTRICITY/TORRENT", "S000005", "3200.00", "", "385300.00"],
    ["CASH DEPOSIT/CDM BRANCH", "S000006", "", "710.00", "386010.00"],
  ];

  rows.forEach((row, index) => {
    const y = 675.9 - index * 13;
    const [narration, reference, debit, credit, balance] = row;
    items.push(item("01/04/2025", 36, y, 40));
    items.push(item("01/04/2025", 88, y, 40));
    items.push(item(narration, 140, y, narration.length * 4.9));
    items.push(item(reference, 340, y, 32));
    // Right-aligned: the left edge moves with the width of the number.
    if (debit) items.push(item(debit, 428 - debit.length * 4.2, y, debit.length * 4.2));
    if (credit) items.push(item(credit, 500 - credit.length * 4.2, y, credit.length * 4.2));
    items.push(item(balance, 559 - balance.length * 4.2, y, balance.length * 4.2));
  });

  return items;
}

/** A plainly left-aligned layout, with every column starting at a fixed x. */
function leftAlignedPage(): TextItem[] {
  const items: TextItem[] = [
    item("Txn Date", 40, 681.9, 38),
    item("Narration", 190, 681.9, 40),
    item("Withdrawal Amt.", 380, 681.9, 62),
    item("Deposit Amt.", 450, 681.9, 52),
    item("Closing Balance", 520, 681.9, 70),
  ];

  const rows: [string, string, string, string][] = [
    ["NEFT CR/MERIDIAN RETAIL", "", "50000.00", "175000.00"],
    ["ACH DR/OFFICE RENT", "18000.00", "", "157000.00"],
    ["NEFT DR/SALARY/RAHUL", "22000.00", "", "135000.00"],
    ["BILLPAY/ELECTRICITY", "3200.00", "", "131800.00"],
    ["CASH DEPOSIT/CDM", "", "15000.00", "146800.00"],
  ];

  rows.forEach((row, index) => {
    const y = 663.9 - index * 16;
    const [narration, debit, credit, balance] = row;
    items.push(item("01/04/2025", 40, y, 45));
    items.push(item(narration, 190, y, narration.length * 4.9));
    if (debit) items.push(item(debit, 380, y, 37.5));
    if (credit) items.push(item(credit, 450, y, 37.5));
    items.push(item(balance, 520, y, 42.5));
  });

  return items;
}

describe("groupIntoLines", () => {
  it("groups runs sharing a baseline and orders them left to right", () => {
    const lines = groupIntoLines([
      item("SECOND", 200, 700, 40),
      item("FIRST", 40, 700, 40),
      item("NEXT ROW", 40, 680, 40),
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0].map((i) => i.text)).toEqual(["FIRST", "SECOND"]);
    expect(lines[1].map((i) => i.text)).toEqual(["NEXT ROW"]);
  });

  it("tolerates sub-point baseline drift within a row", () => {
    const lines = groupIntoLines([
      item("A", 40, 700, 10),
      item("B", 100, 701.8, 10),
    ]);
    expect(lines).toHaveLength(1);
  });
});

describe("columnRanges — right-aligned amounts", () => {
  const lines = groupIntoLines(rightAlignedPage());
  const ranges = columnRanges(lines);

  it("finds all seven columns despite the amounts having ragged left edges", () => {
    expect(ranges).toHaveLength(7);
  });

  // The regression this whole approach exists for: "Withdrawal Amt." in the
  // header overhangs "Chq/Ref No", and one such line must not merge them.
  it("does not let a single overlapping header label fuse two columns", () => {
    const referenceColumn = ranges.find((range) => range.start <= 340 && range.end >= 372);
    expect(referenceColumn).toBeDefined();
    expect(referenceColumn!.end).toBeLessThan(395);
  });

  it("puts every value in the right column, whatever the number's width", () => {
    // Row 1: a debit, no credit.
    const debitRow = splitIntoRanges(lines[1], ranges);
    expect(debitRow[0]).toBe("01/04/2025");
    expect(debitRow[2]).toBe("NEFT DR/SALARY/RAHUL MEHTA");
    expect(debitRow[3]).toBe("S000001");
    expect(debitRow[4]).toBe("12000.00");
    expect(debitRow[5]).toBe("");
    expect(debitRow[6]).toBe("400500.00");

    // Row 3: a credit, no debit — the credit must not land in the debit column.
    const creditRow = splitIntoRanges(lines[3], ranges);
    expect(creditRow[4]).toBe("");
    expect(creditRow[5]).toBe("26500.00");
    expect(creditRow[6]).toBe("406500.00");

    // A short amount sits far right of a long one but belongs to the same column.
    const shortCredit = splitIntoRanges(lines[6], ranges);
    expect(shortCredit[5]).toBe("710.00");
  });

  it("keeps the header row aligned with the data columns", () => {
    const header = splitIntoRanges(lines[0], ranges);
    expect(header[3]).toBe("Chq/Ref No");
    expect(header[4]).toBe("Withdrawal Amt.");
    expect(header[5]).toBe("Deposit Amt.");
    expect(header[6]).toBe("Closing Balance");
  });
});

describe("columnRanges — left-aligned layout", () => {
  const lines = groupIntoLines(leftAlignedPage());
  const ranges = columnRanges(lines);

  it("still resolves a plain left-aligned table", () => {
    expect(ranges.length).toBeGreaterThanOrEqual(5);
    const row = splitIntoRanges(lines[1], ranges);
    expect(row[0]).toBe("01/04/2025");
    expect(row[1]).toBe("NEFT CR/MERIDIAN RETAIL");
    expect(row[2]).toBe("");
    expect(row[3]).toBe("50000.00");
    expect(row[4]).toBe("175000.00");
  });
});

describe("columnRanges — degenerate input", () => {
  it("returns nothing when there is no table to find", () => {
    expect(columnRanges([])).toEqual([]);
    expect(columnRanges([[item("A single line of prose", 40, 700, 200)]])).toEqual([]);
  });
});
