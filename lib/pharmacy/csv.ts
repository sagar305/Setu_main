// CSV export for every report, and the medicine-master importer.
//
// The importer carries more weight here than in the other apps. The decision
// was to ship no drug dataset — a wrong strength or a wrong schedule in a
// seeded list is not like a wrong price in a product list — so a shop's first
// hour with this app is importing the master they already have, out of their
// old software or their distributor's price list. If that import is fussy, the
// app never gets used.

import {
  FORM_LABELS,
  MEDICINE_FORMS,
  SCHEDULE_LABELS,
  formatExpiry,
  type Batch,
  type Medicine,
  type MedicineForm,
  type Purchase,
  type PurchaseReturn,
  type Sale,
  type SaleReturn,
  type ScheduleClass,
  type StockLog,
  type Supplier,
} from "./types";
import { STOCK_MOVEMENT_LABELS } from "./types";
import { saleDue } from "./calc";
import type {
  CustomerDueRow,
  GstRow,
  MarginRow,
  RegisterRow,
  ReorderRow,
  SalesByDayRow,
  SupplierRow,
} from "./reports";

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  return lines.join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  // BOM so Excel opens UTF-8 (₹, names in Indic scripts) correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const MEDICINE_CSV_HEADERS = [
  "Name",
  "Composition",
  "Manufacturer",
  "Strength",
  "Form",
  "Pack size",
  "Pack label",
  "HSN",
  "Tax %",
  "Schedule",
  "Rack",
  "Barcode",
  "Low stock at",
];

export function medicinesCsv(medicines: Medicine[]): string {
  return toCsv(
    MEDICINE_CSV_HEADERS,
    medicines.map((medicine) => [
      medicine.name,
      medicine.composition,
      medicine.manufacturer,
      medicine.strength,
      medicine.form,
      medicine.packSize,
      medicine.packLabel,
      medicine.hsnCode,
      medicine.taxRate,
      medicine.schedule,
      medicine.rack,
      medicine.barcode,
      medicine.lowStockAt,
    ])
  );
}

export function batchesCsv(batches: Batch[], medicines: Medicine[], suppliers: Supplier[]): string {
  const medicineName = (id: string) => medicines.find((m) => m.id === id)?.name ?? "";
  const supplierName = (id: string | null) =>
    id ? (suppliers.find((s) => s.id === id)?.name ?? "") : "";
  return toCsv(
    [
      "Medicine",
      "Batch no",
      "Expiry",
      "Quantity",
      "MRP",
      "Selling rate",
      "Purchase rate",
      "Effective cost",
      "Value at cost",
      "Supplier",
    ],
    batches.map((batch) => [
      medicineName(batch.medicineId),
      batch.batchNo,
      formatExpiry(batch.expiry),
      batch.quantity,
      batch.mrp,
      batch.sellingRate,
      batch.purchaseRate,
      batch.effectiveRate,
      Number((batch.effectiveRate * batch.quantity).toFixed(2)),
      supplierName(batch.supplierId),
    ])
  );
}

export function salesCsv(sales: Sale[]): string {
  return toCsv(
    ["Invoice", "Date", "Items", "Discount", "Tax", "Total", "Paid", "Balance", "Payment mode"],
    sales.map((sale) => [
      sale.invoiceNo,
      sale.date,
      sale.lines.length,
      sale.discount,
      sale.taxTotal,
      sale.total,
      sale.paid,
      saleDue(sale),
      sale.paymentMode,
    ])
  );
}

export function salesByDayCsv(rows: SalesByDayRow[], label = "Date"): string {
  return toCsv(
    [label, "Bills", "Items", "Discount", "Tax", "Total"],
    rows.map((row) => [row.date, row.bills, row.items, row.discount, row.tax, row.total])
  );
}

export function marginCsv(rows: MarginRow[]): string {
  return toCsv(
    ["Medicine", "Units sold", "Revenue", "Cost", "Margin", "Margin %"],
    rows.map((row) => [row.name, row.quantity, row.revenue, row.cost, row.margin, row.marginPct])
  );
}

export function gstCsv(rows: GstRow[]): string {
  return toCsv(
    ["Tax rate %", "Taxable value", "CGST", "SGST", "Total tax"],
    rows.map((row) => [row.rate, row.taxable, row.cgst, row.sgst, row.tax])
  );
}

export function registerCsv(rows: RegisterRow[]): string {
  return toCsv(
    [
      "Date",
      "Invoice",
      "Patient",
      "Doctor",
      "Reg no",
      "Medicine",
      "Schedule",
      "Batch",
      "Expiry",
      "Qty",
    ],
    rows.map((row) => [
      row.date,
      row.invoiceNo,
      row.patientName,
      row.doctorName,
      row.doctorRegNo,
      row.medicine,
      row.schedule,
      row.batchNo,
      row.expiry,
      row.quantity,
    ])
  );
}

export function reorderCsv(rows: ReorderRow[], suppliers: Supplier[]): string {
  const supplierName = (id: string | null) =>
    id ? (suppliers.find((s) => s.id === id)?.name ?? "") : "";
  return toCsv(
    ["Supplier", "Medicine", "Composition", "Pack", "In stock", "Low stock at", "Sold last 30 days"],
    rows.map((row) => [
      supplierName(row.supplierId),
      row.medicine.name,
      row.medicine.composition,
      row.medicine.packLabel,
      row.available,
      row.medicine.lowStockAt,
      row.soldLast30,
    ])
  );
}

export function supplierCsv(rows: SupplierRow[]): string {
  return toCsv(
    ["Supplier", "Purchases", "Purchased", "Paid", "Returned", "Outstanding"],
    rows.map((row) => [
      row.supplier?.name ?? "—",
      row.purchases,
      row.purchased,
      row.paid,
      row.returned,
      row.outstanding,
    ])
  );
}

export function customerDuesCsv(rows: CustomerDueRow[]): string {
  return toCsv(
    ["Customer", "Phone", "Bills", "Billed", "Paid", "Returned", "Due"],
    rows.map((row) => [
      row.customer.name,
      row.customer.phone,
      row.bills,
      row.billed,
      row.paid,
      row.returned,
      row.due,
    ])
  );
}

export function purchasesCsv(purchases: Purchase[], suppliers: Supplier[]): string {
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "";
  return toCsv(
    ["Invoice", "Date", "Supplier", "Lines", "Discount", "Tax", "Total", "Paid", "Outstanding"],
    purchases.map((purchase) => [
      purchase.invoiceNo,
      purchase.date,
      supplierName(purchase.supplierId),
      purchase.lines.length,
      purchase.discount,
      purchase.taxTotal,
      purchase.total,
      purchase.paid,
      Number(Math.max(0, purchase.total - purchase.paid).toFixed(2)),
    ])
  );
}

export function returnsCsv(
  saleReturns: SaleReturn[],
  purchaseReturns: PurchaseReturn[],
  suppliers: Supplier[]
): string {
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "";
  return toCsv(
    ["Kind", "Reference", "Date", "Supplier", "Reason", "Total"],
    [
      ...saleReturns.map((row) => [
        "Sale return",
        row.saleInvoiceNo,
        row.date,
        "",
        row.reason,
        row.total,
      ]),
      ...purchaseReturns.map((row) => [
        "Purchase return",
        row.noteNo,
        row.date,
        supplierName(row.supplierId),
        row.reason,
        row.total,
      ]),
    ]
  );
}

export function stockLogCsv(rows: StockLog[]): string {
  return toCsv(
    ["When", "Medicine", "Batch", "Expiry", "Movement", "Change", "Quantity after", "Note"],
    rows.map((row) => [
      row.createdAt,
      row.medicineName,
      row.batchNo,
      formatExpiry(row.expiry),
      STOCK_MOVEMENT_LABELS[row.type],
      row.change,
      row.quantityAfter,
      row.note,
    ])
  );
}

export function expiryCsv(batches: Batch[], medicines: Medicine[], suppliers: Supplier[]): string {
  return batchesCsv(batches, medicines, suppliers);
}

// ---------------------------------------------------------------------------
// Medicine master import
// ---------------------------------------------------------------------------

export type ParsedMedicineRow = Omit<Medicine, "id" | "createdAt" | "updatedAt">;

export type MedicineImportResult = {
  rows: ParsedMedicineRow[];
  errors: string[];
};

type ImportField =
  | "name"
  | "composition"
  | "manufacturer"
  | "strength"
  | "form"
  | "packSize"
  | "packLabel"
  | "hsnCode"
  | "taxRate"
  | "schedule"
  | "rack"
  | "barcode"
  | "lowStockAt"
  | null;

/**
 * Header aliases.
 *
 * Every one of these is a column name seen on a real distributor price list or
 * an export from the billing software a shop is leaving. "Salt", "generic" and
 * "content" all mean composition; a wide net here is the difference between an
 * import that works and one the owner gives up on.
 */
const HEADER_ALIASES: Record<string, ImportField> = {
  name: "name",
  medicine: "name",
  "medicine name": "name",
  brand: "name",
  "brand name": "name",
  product: "name",
  item: "name",
  description: "name",
  composition: "composition",
  salt: "composition",
  "salt name": "composition",
  generic: "composition",
  "generic name": "composition",
  content: "composition",
  molecule: "composition",
  manufacturer: "manufacturer",
  company: "manufacturer",
  mfr: "manufacturer",
  "mfg company": "manufacturer",
  marketer: "manufacturer",
  strength: "strength",
  dose: "strength",
  dosage: "strength",
  form: "form",
  type: "form",
  "dosage form": "form",
  "pack size": "packSize",
  packsize: "packSize",
  "units per pack": "packSize",
  qty_per_pack: "packSize",
  pack: "packLabel",
  "pack label": "packLabel",
  packing: "packLabel",
  hsn: "hsnCode",
  "hsn code": "hsnCode",
  hsncode: "hsnCode",
  gst: "taxRate",
  "gst %": "taxRate",
  "tax %": "taxRate",
  tax: "taxRate",
  taxrate: "taxRate",
  "gst rate": "taxRate",
  schedule: "schedule",
  "drug schedule": "schedule",
  "schedule class": "schedule",
  rack: "rack",
  shelf: "rack",
  location: "rack",
  barcode: "barcode",
  ean: "barcode",
  "bar code": "barcode",
  "low stock at": "lowStockAt",
  reorder: "lowStockAt",
  "reorder level": "lowStockAt",
  "min qty": "lowStockAt",
};

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normaliseForm(value: string): MedicineForm {
  const text = value.trim().toLowerCase();
  if (!text) return "tablet";
  const direct = MEDICINE_FORMS.find((form) => form === text);
  if (direct) return direct;
  if (/^tab/.test(text)) return "tablet";
  if (/^cap/.test(text)) return "capsule";
  if (/^(syp|syr|susp|liquid|elixir)/.test(text)) return "syrup";
  if (/^(inj|amp|vial)/.test(text)) return "injection";
  if (/^(drop|eye|ear)/.test(text)) return "drops";
  if (/^(oint|cream|gel|lotion)/.test(text)) return "ointment";
  if (/^(inhal|rotacap|respul)/.test(text)) return "inhaler";
  if (/^(sach|powder|granule)/.test(text)) return "sachet";
  return "other";
}

/**
 * Read a schedule out of whatever the source called it.
 *
 * Anything unrecognised becomes unscheduled rather than a guess. Putting a
 * medicine in Schedule H that is not in it forces a prescription the counter
 * cannot produce; leaving it out is visible and fixable in the master.
 */
function normaliseSchedule(value: string): ScheduleClass {
  const text = value.trim().toUpperCase().replace(/^SCHEDULE\s*/, "").replace(/[()\s.-]/g, "");
  if (text === "H") return "H";
  if (text === "H1") return "H1";
  if (text === "X") return "X";
  if (text === "G") return "G";
  if (text === "OTC") return "OTC";
  return "";
}

function toNumber(value: string, fallback: number): number {
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : fallback;
}

/**
 * Parse a pasted spreadsheet block or CSV file.
 *
 * A header row is used when present; otherwise columns are read positionally as
 * Name, Composition, Manufacturer, Strength, Pack size. Rows without a name are
 * reported rather than silently dropped, because a price list with a blank
 * first column is usually a category heading and the owner should see how many
 * were skipped.
 */
export function parseMedicineImport(text: string): MedicineImportResult {
  const errors: string[] = [];
  const rows: ParsedMedicineRow[] = [];

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { rows, errors: ["Nothing to import."] };

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const firstCells = splitLine(lines[0], delimiter).map((cell) =>
    cell.toLowerCase().replace(/﻿/g, "")
  );
  const hasHeader = firstCells.some((cell) =>
    ["name", "medicine", "medicine name", "brand", "brand name", "product", "item"].includes(cell)
  );

  const columns: ImportField[] = hasHeader
    ? firstCells.map((cell) => HEADER_ALIASES[cell] ?? null)
    : ["name", "composition", "manufacturer", "strength", "packSize"];

  const seen = new Set<string>();

  for (const [index, line] of lines.entries()) {
    if (hasHeader && index === 0) continue;
    const cells = splitLine(line, delimiter);

    const row: ParsedMedicineRow = {
      name: "",
      composition: "",
      manufacturer: "",
      strength: "",
      form: "tablet",
      packSize: 10,
      packLabel: "",
      hsnCode: "",
      taxRate: 12,
      schedule: "",
      rack: "",
      barcode: "",
      lowStockAt: 0,
      active: true,
    };

    cells.forEach((value, columnIndex) => {
      const field = columns[columnIndex];
      if (!field || !value) return;
      switch (field) {
        case "form":
          row.form = normaliseForm(value);
          break;
        case "schedule":
          row.schedule = normaliseSchedule(value);
          break;
        case "packSize":
          row.packSize = Math.max(1, Math.round(toNumber(value, 10)));
          break;
        case "taxRate":
          row.taxRate = Math.max(0, toNumber(value, 12));
          break;
        case "lowStockAt":
          row.lowStockAt = Math.max(0, Math.round(toNumber(value, 0)));
          break;
        default:
          row[field] = value;
      }
    });

    if (!row.name) {
      errors.push(`Row ${index + 1}: no medicine name — skipped.`);
      continue;
    }
    const key = `${row.name.toLowerCase()}|${row.strength.toLowerCase()}`;
    if (seen.has(key)) {
      errors.push(`Row ${index + 1}: "${row.name}" repeats earlier in the file — skipped.`);
      continue;
    }
    seen.add(key);
    if (!row.packLabel) {
      row.packLabel = `${FORM_LABELS[row.form].toLowerCase()} of ${row.packSize}`;
    }
    rows.push(row);
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push("No medicines found in that file.");
  }
  return { rows, errors };
}

/** A blank file the owner can fill in, so the columns are never a guess. */
export function medicineTemplateCsv(): string {
  return toCsv(MEDICINE_CSV_HEADERS, [
    [
      "Crocin Advance",
      "Paracetamol 500mg",
      "GSK",
      "500 mg",
      "tablet",
      15,
      "strip of 15",
      "30049099",
      12,
      "",
      "A1",
      "",
      30,
    ],
    [
      "Azithral 500",
      "Azithromycin 500mg",
      "Alembic",
      "500 mg",
      "tablet",
      5,
      "strip of 5",
      "30042019",
      12,
      "H",
      "B3",
      "",
      10,
    ],
  ]);
}

export { SCHEDULE_LABELS };
