// XLSX / XLS → raw rows, via SheetJS (already a dependency of this repo).
// Spreadsheets are treated as untrusted data (§20): we read cell values only,
// never formulas, macros or embedded objects.

import * as XLSX from "xlsx";
import type { RawRow } from "@/lib/bankStatement/types";
import { sanitiseCell } from "@/lib/bankStatement/utils/text";

/**
 * Read the first non-empty sheet into raw rows. Dates are kept as text in the
 * statement's own formatting so the date-format detector — not Excel's locale
 * guess — decides how they are read.
 */
export function parseWorkbook(data: ArrayBuffer): { rows: RawRow[]; sheetName: string } {
  const workbook = XLSX.read(data, {
    type: "array",
    cellDates: true,
    cellFormula: false,
    cellHTML: false,
    dense: false,
  });

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });

    const rows: RawRow[] = [];
    grid.forEach((cells, index) => {
      const values = (cells as unknown[]).map((cell) => cellToText(cell));
      if (values.every((value) => value === "")) return;
      rows.push({ cells: values, row: index + 1 });
    });

    if (rows.length > 0) return { rows, sheetName };
  }

  return { rows: [], sheetName: workbook.SheetNames[0] ?? "" };
}

function cellToText(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) {
    // Excel dates arrive as JS Dates; emit ISO so the date parser is exact.
    const year = cell.getFullYear();
    const month = String(cell.getMonth() + 1).padStart(2, "0");
    const day = String(cell.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return sanitiseCell(String(cell));
}
