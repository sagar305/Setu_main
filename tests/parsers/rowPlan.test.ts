// The CA's corrections to the shape of the table.
// ---------------------------------------------------------------------------
// These are the four repairs that between them fix most statements detection
// gets wrong, so each one is pinned: where the table starts and ends, which
// rows are not transactions, which are the tail of the row above, and where the
// header actually is.

import { describe, expect, it } from "vitest";
import type { RawRow } from "@/lib/bankStatement/types";
import {
  applyRowPlan,
  describeRowPlan,
  isRowPlanEmpty,
  suggestMergeUp,
} from "@/lib/bankStatement/parser/rowPlan";

function row(cells: string[], meta: Partial<RawRow> = {}): RawRow {
  return { cells, ...meta };
}

/** A statement shaped the way a real PDF comes out: letterhead, header, rows
 *  with a wrapped narration in the middle, a subtotal, and a footer. */
const GRID: RawRow[] = [
  row(["STATE BANK OF INDIA"]),
  row(["Account Statement for 01-04-2025 to 30-04-2025"]),
  row(["Account Number: XXXXXXXX1234"]),
  row(["Date", "Description", "Debit", "Credit", "Balance"]),
  row(["01/04/2025", "UPI/9033/BIGBASKET", "1200.00", "", "48800.00"]),
  row(["", "BBNOW ORDER REF 4471", "", "", ""]),
  row(["03/04/2025", "NEFT CR/ACME CORP SAL", "", "45000.00", "93800.00"]),
  row(["", "", "1200.00", "45000.00", ""]),
  row(["Page 1 of 3"]),
];

describe("an empty plan", () => {
  it("is recognised as empty", () => {
    expect(isRowPlanEmpty({})).toBe(true);
    expect(isRowPlanEmpty({ skipRows: [], mergeUp: [] })).toBe(true);
    expect(isRowPlanEmpty({ startRow: 0 })).toBe(false);
  });

  it("changes nothing", () => {
    const result = applyRowPlan(GRID, {});
    expect(result.rows.length).toBe(GRID.length);
    expect(result.headerIndex).toBe(-1);
  });
});

describe("where the table starts and ends", () => {
  it("drops the letterhead above the start", () => {
    const result = applyRowPlan(GRID, { startRow: 3 });
    expect(result.rows[0].cells[0]).toBe("Date");
    expect(result.rows.length).toBe(6);
  });

  it("drops the footer below the end, inclusively", () => {
    const result = applyRowPlan(GRID, { startRow: 3, endRow: 7 });
    expect(result.rows.length).toBe(5);
    expect(result.rows.some((entry) => entry.cells[0] === "Page 1 of 3")).toBe(false);
  });

  it("survives markers pointing outside the file", () => {
    expect(applyRowPlan(GRID, { startRow: -5 }).rows.length).toBe(GRID.length);
    expect(applyRowPlan(GRID, { endRow: 9999 }).rows.length).toBe(GRID.length);
    // A start beyond the end cannot produce a negative range.
    expect(applyRowPlan(GRID, { startRow: 8, endRow: 2 }).rows.length).toBe(1);
  });

  it("does nothing to an empty file", () => {
    expect(applyRowPlan([], { startRow: 2 })).toEqual({ rows: [], headerIndex: -1 });
  });
});

describe("rows that are not transactions", () => {
  it("removes them", () => {
    const result = applyRowPlan(GRID, { startRow: 4, skipRows: [7] });
    expect(result.rows.some((entry) => entry.cells[2] === "1200.00" && entry.cells[0] === "")).toBe(
      false
    );
  });
});

describe("wrapped narrations", () => {
  it("folds a continuation into the row above, column by column", () => {
    const result = applyRowPlan(GRID, { startRow: 4, endRow: 6, mergeUp: [5] });

    expect(result.rows.length).toBe(2);
    expect(result.rows[0].cells[1]).toBe("UPI/9033/BIGBASKET BBNOW ORDER REF 4471");
    // The amounts on the row above are untouched by the join.
    expect(result.rows[0].cells[2]).toBe("1200.00");
    expect(result.rows[0].cells[4]).toBe("48800.00");
  });

  it("keeps a continuation that has nothing above it rather than losing it", () => {
    const result = applyRowPlan(GRID, { startRow: 5, mergeUp: [5] });
    expect(result.rows[0].cells[1]).toBe("BBNOW ORDER REF 4471");
  });

  it("does not mutate the grid it was given", () => {
    const before = JSON.stringify(GRID);
    applyRowPlan(GRID, { startRow: 4, mergeUp: [5] });
    expect(JSON.stringify(GRID)).toBe(before);
  });

  // Skipping and merging the same row would be contradictory; skip wins because
  // it is the stronger statement — the row is not part of the table at all.
  it("prefers a skip over a merge for the same row", () => {
    const result = applyRowPlan(GRID, { startRow: 4, skipRows: [5], mergeUp: [5] });
    expect(result.rows[0].cells[1]).toBe("UPI/9033/BIGBASKET");
  });
});

describe("the header row", () => {
  it("reports where the header ended up after rows shifted", () => {
    const result = applyRowPlan(GRID, { startRow: 2, headerRow: 3 });
    expect(result.headerIndex).toBe(1);
    expect(result.rows[result.headerIndex].cells[0]).toBe("Date");
  });

  it("reports no header when the plan names none", () => {
    expect(applyRowPlan(GRID, { startRow: 3 }).headerIndex).toBe(-1);
  });

  it("reports no header when the named row was skipped", () => {
    expect(applyRowPlan(GRID, { headerRow: 3, skipRows: [3] }).headerIndex).toBe(-1);
  });
});

describe("suggesting the wrapped lines", () => {
  it("finds a row with no date and no amount", () => {
    expect(suggestMergeUp(GRID, { startRow: 4 })).toContain(5);
  });

  it("leaves real transactions alone", () => {
    const suggestions = suggestMergeUp(GRID, { startRow: 4 });
    expect(suggestions).not.toContain(4);
    expect(suggestions).not.toContain(6);
  });

  it("never suggests the header row", () => {
    expect(suggestMergeUp(GRID, { startRow: 0, headerRow: 3 })).not.toContain(3);
  });

  it("never suggests the first row, which has nothing to join to", () => {
    expect(suggestMergeUp(GRID, { startRow: 4 })).not.toContain(4);
  });

  // The letterhead is also "text with no date and no amount". Offering to glue
  // the branch address onto the account number would be worse than offering
  // nothing, and the CA has usually not set a start marker yet at this point.
  it("never suggests the letterhead, even with no markers set at all", () => {
    const suggestions = suggestMergeUp(GRID, {});
    expect(suggestions).toEqual([5]);
    for (const preamble of [0, 1, 2, 3]) expect(suggestions).not.toContain(preamble);
  });

  it("suggests nothing when no row looks like a transaction", () => {
    expect(suggestMergeUp(GRID.slice(0, 4), {})).toEqual([]);
  });

  // "Page 1 of 3" has no date and no amount either. It is a footer, not a
  // wrapped narration, and joining it would pollute the last transaction.
  it("never suggests a footer after the last transaction", () => {
    expect(suggestMergeUp(GRID, {})).not.toContain(8);
  });

  it("ignores blank rows, which carry nothing worth joining", () => {
    const withBlank = [...GRID, row(["", "", "", "", ""])];
    expect(suggestMergeUp(withBlank, { startRow: 4 })).not.toContain(withBlank.length - 1);
  });
});

describe("describing a plan", () => {
  it("says so when there is nothing to say", () => {
    expect(describeRowPlan({})).toBe("No changes");
  });

  it("reads in one-based rows, as the grid shows them", () => {
    const description = describeRowPlan({ startRow: 3, endRow: 7, headerRow: 3, skipRows: [8], mergeUp: [5, 9] });
    expect(description).toContain("rows 4–8");
    expect(description).toContain("header on row 4");
    expect(description).toContain("1 row skipped");
    expect(description).toContain("2 rows joined");
  });
});
