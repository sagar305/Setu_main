// Bulk import of past sales (Orders → Import past sales) from a CSV or Excel
// sheet. One row per item; rows that share a Bill No become one bill.
//
//   Date        Time   Bill No  Product  Quantity  Price  Discount  Payment Method  Customer
//   2026-10-01  10:30  A-101    Tea      2         20                Cash            Ramesh
//   2026-10-01  10:30  A-101    Samosa   1         15     5
//
// Everything is parsed and checked in the browser; nothing is saved until the
// user confirms the preview.

import type { CartLine, Customer, PaymentMethod, Product } from "./types";
import { toCsv } from "./csv";

export const SALES_IMPORT_HEADERS = [
  "Date",
  "Time",
  "Bill No",
  "Product",
  "Quantity",
  "Price",
  "Discount",
  "Payment Method",
  "Customer",
] as const;

/** Upper bound so a wrong file (e.g. a bank statement) can't freeze the tab. */
const MAX_ROWS = 5000;

export type ImportedSale = {
  /** Bill No from the sheet ("" when the row had none). */
  sourceBillNo: string;
  /** ISO datetime of the sale. */
  date: string;
  lines: CartLine[];
  /** Flat discount on the whole bill. */
  discountValue: number;
  paymentMethodId: string;
  paymentMethodName: string;
  customerId: string | null;
  customerName: string;
};

export type SalesImportResult = {
  sales: ImportedSale[];
  /** Human-readable problems, each naming the sheet row. Import is blocked while any exist. */
  errors: string[];
  /** Product names that didn't match the catalog (imported as one-off items). */
  unmatchedProducts: string[];
};

type Cell = string | number | boolean | Date | null | undefined;

export function salesImportTemplateCsv(): string {
  return toCsv(
    [...SALES_IMPORT_HEADERS],
    [
      ["2026-10-01", "10:30", "A-101", "Tea", 2, 20, "", "Cash", "Walk-in"],
      ["2026-10-01", "10:30", "A-101", "Samosa", 1, 15, 5, "Cash", "Walk-in"],
      ["02-10-2026", "18:05", "A-102", "Biscuit", 3, 10, "", "UPI", ""],
    ]
  );
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[\s_.-]+/g, " ");
}

const HEADER_ALIASES: Record<string, (typeof SALES_IMPORT_HEADERS)[number]> = {
  date: "Date",
  "sale date": "Date",
  time: "Time",
  "bill no": "Bill No",
  "bill number": "Bill No",
  bill: "Bill No",
  "invoice no": "Bill No",
  "invoice number": "Bill No",
  invoice: "Bill No",
  product: "Product",
  item: "Product",
  "item name": "Product",
  "product name": "Product",
  quantity: "Quantity",
  qty: "Quantity",
  price: "Price",
  rate: "Price",
  "unit price": "Price",
  discount: "Discount",
  "payment method": "Payment Method",
  payment: "Payment Method",
  mode: "Payment Method",
  "payment mode": "Payment Method",
  customer: "Customer",
  "customer name": "Customer",
};

function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return cell.toISOString();
  return String(cell).trim();
}

function parseNumber(cell: Cell): number | null {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  const text = cellText(cell).replace(/[₹$€£,\s]/g, "");
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * Accepts YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY (Indian day-first order) and
 * Excel date cells. Returns local midnight of that day, or null.
 */
function parseDay(cell: Cell): Date | null {
  if (typeof cell === "number") {
    // Excel serial day (1 = 1900-01-01; JS Date rolls the day overflow).
    return cell >= 1 && cell < 2958466 ? new Date(1899, 11, 30 + Math.floor(cell)) : null;
  }
  if (cell instanceof Date) {
    return Number.isNaN(cell.getTime())
      ? null
      : new Date(cell.getFullYear(), cell.getMonth(), cell.getDate());
  }
  const text = cellText(cell).split(/[ T]/)[0];
  let y: number, m: number, d: number;
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  }
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** "18:05", "6:05 PM", Excel time cells. Returns minutes after midnight, or null. */
function parseTime(cell: Cell): number | null {
  if (cell instanceof Date) return cell.getHours() * 60 + cell.getMinutes();
  if (typeof cell === "number" && cell >= 0 && cell < 1) return Math.round(cell * 24 * 60);
  const text = cellText(cell).toLowerCase();
  if (!text) return null;
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/);
  if (!match) return null;
  let h = Number(match[1]);
  const min = Number(match[2]);
  if (match[3]) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (match[3] === "pm" ? 12 : 0);
  }
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** A time written inside the Date cell ("2026-10-01 10:30"). */
function timeInDateCell(cell: Cell): number | null {
  if (typeof cell === "number") {
    const minutes = Math.round((cell - Math.floor(cell)) * 24 * 60);
    return minutes === 0 ? null : minutes;
  }
  if (cell instanceof Date) {
    const minutes = cell.getHours() * 60 + cell.getMinutes();
    return minutes === 0 ? null : minutes;
  }
  const rest = cellText(cell).split(/[ T]/).slice(1).join(" ");
  return rest ? parseTime(rest) : null;
}

/**
 * Turn sheet rows (first row = headers) into bills, matched against the POS
 * catalog, customers and payment methods.
 */
export function parseSalesRows(
  rows: Cell[][],
  context: {
    products: Product[];
    customers: Customer[];
    payments: PaymentMethod[];
    taxEnabled: boolean;
    defaultTaxRate: number;
  }
): SalesImportResult {
  const errors: string[] = [];
  const unmatched = new Set<string>();

  const headerIndex = rows.findIndex((row) => row.some((cell) => cellText(cell) !== ""));
  if (headerIndex === -1) return { sales: [], errors: ["The file is empty."], unmatchedProducts: [] };

  const columns = new Map<string, number>();
  rows[headerIndex].forEach((cell, i) => {
    const key = HEADER_ALIASES[normalize(cellText(cell))];
    if (key && !columns.has(key)) columns.set(key, i);
  });
  for (const required of ["Date", "Product", "Quantity"]) {
    if (!columns.has(required)) {
      errors.push(`Missing a "${required}" column. Download the template to see the expected format.`);
    }
  }
  if (errors.length) return { sales: [], errors, unmatchedProducts: [] };

  const dataRows = rows.slice(headerIndex + 1);
  if (dataRows.length > MAX_ROWS) {
    return {
      sales: [],
      errors: [`The file has ${dataRows.length} rows; import at most ${MAX_ROWS} at a time.`],
      unmatchedProducts: [],
    };
  }

  const get = (row: Cell[], key: string): Cell => {
    const i = columns.get(key);
    return i === undefined ? undefined : row[i];
  };
  const productByName = new Map(context.products.map((p) => [normalize(p.name), p]));
  const findCustomer = (text: string) => {
    const q = normalize(text);
    const digits = text.replace(/\D/g, "");
    return context.customers.find(
      (c) =>
        normalize(c.name) === q ||
        (digits.length >= 6 && c.phone.replace(/\D/g, "").endsWith(digits.slice(-10)))
    );
  };
  const findPayment = (text: string) =>
    context.payments.find((p) => normalize(p.name) === normalize(text));
  const defaultPayment = context.payments[0];
  const now = Date.now();

  const bills = new Map<string, ImportedSale>();
  const order: string[] = [];

  dataRows.forEach((row, offset) => {
    if (!row.some((cell) => cellText(cell) !== "")) return;
    const rowNo = headerIndex + offset + 2; // 1-based sheet row
    const rowErrors: string[] = [];

    const productText = cellText(get(row, "Product"));
    if (!productText) rowErrors.push("product name is empty");

    const quantity = parseNumber(get(row, "Quantity"));
    if (quantity === null || quantity <= 0) rowErrors.push("quantity must be more than 0");

    const product = productByName.get(normalize(productText));
    const priceCell = parseNumber(get(row, "Price"));
    const price = priceCell ?? product?.sellingPrice ?? null;
    if (price === null) rowErrors.push(`price is empty and "${productText}" is not in your products`);
    else if (price < 0) rowErrors.push("price cannot be negative");

    const day = parseDay(get(row, "Date"));
    let dateIso = "";
    if (!day) {
      rowErrors.push(`date "${cellText(get(row, "Date"))}" is not valid (use YYYY-MM-DD or DD-MM-YYYY)`);
    } else {
      const timeCell = get(row, "Time");
      let minutes = timeInDateCell(get(row, "Date"));
      if (cellText(timeCell)) {
        minutes = parseTime(timeCell);
        if (minutes === null) rowErrors.push(`time "${cellText(timeCell)}" is not valid (use HH:MM)`);
      }
      // No time given: noon keeps the sale on the right day in every zone.
      const at = new Date(day.getTime() + (minutes ?? 12 * 60) * 60000);
      if (at.getTime() > now) rowErrors.push("date is in the future");
      dateIso = at.toISOString();
    }

    const paymentText = cellText(get(row, "Payment Method"));
    const payment = paymentText ? findPayment(paymentText) : defaultPayment;
    if (!payment) {
      rowErrors.push(
        paymentText
          ? `payment method "${paymentText}" not found (yours: ${context.payments.map((p) => p.name).join(", ")})`
          : "add a payment method in Settings first"
      );
    }

    const discount = parseNumber(get(row, "Discount"));
    if (discount !== null && discount < 0) rowErrors.push("discount cannot be negative");

    if (rowErrors.length) {
      errors.push(`Row ${rowNo}: ${rowErrors.join("; ")}.`);
      return;
    }

    if (!product) unmatched.add(productText);
    const taxRate = product && context.taxEnabled ? product.taxRate ?? context.defaultTaxRate : 0;
    const line: CartLine = {
      productId: product?.id ?? "",
      name: product?.name ?? productText,
      price: price!,
      quantity: quantity!,
      unit: product?.unit ?? "",
      taxRate,
      taxInclusive: product?.taxInclusive ?? false,
    };

    const billNo = cellText(get(row, "Bill No"));
    const key = billNo ? `bill:${billNo}` : `row:${rowNo}`;
    const existing = bills.get(key);
    if (existing) {
      if (new Date(existing.date).toDateString() !== new Date(dateIso).toDateString()) {
        errors.push(`Row ${rowNo}: bill "${billNo}" has a different date on an earlier row.`);
        return;
      }
      existing.lines.push(line);
      existing.discountValue += discount ?? 0;
      return;
    }

    const customerText = cellText(get(row, "Customer"));
    const isWalkIn = !customerText || normalize(customerText) === "walk in";
    const customer = isWalkIn ? undefined : findCustomer(customerText);
    bills.set(key, {
      sourceBillNo: billNo,
      date: dateIso,
      lines: [line],
      discountValue: discount ?? 0,
      paymentMethodId: payment!.id,
      paymentMethodName: payment!.name,
      customerId: customer?.id ?? null,
      customerName: isWalkIn ? "" : customer?.name ?? customerText,
    });
    order.push(key);
  });

  if (order.length === 0 && errors.length === 0) errors.push("No sale rows found under the headers.");

  return {
    sales: order.map((key) => bills.get(key)!),
    errors,
    unmatchedProducts: Array.from(unmatched),
  };
}

/** Read the first sheet of an uploaded .csv/.xlsx/.xls file into rows. */
export async function readSalesFile(file: File): Promise<Cell[][]> {
  const XLSX = await import("xlsx");
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  // CSV: read as text and keep every cell a string, so "02-10-2026" is
  // parsed day-first by us rather than month-first by the sheet library.
  // Excel: date cells stay serial numbers, converted in parseDay/parseTime.
  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: "string", raw: true })
    : XLSX.read(await file.arrayBuffer());
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json<Cell[]>(workbook.Sheets[sheetName], {
    header: 1,
    blankrows: false,
    raw: true,
    defval: "",
  });
}
