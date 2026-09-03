// Google Sheet sync for the pharmacy.
//
// Same protocol as the POS, rental, tuition, clinic and queue syncs: the owner
// pastes the Apps Script into their own Google Sheet, deploys it as a web app,
// and this pushes whole-tab snapshots to that URL. Off until a URL is pasted;
// nothing leaves the device otherwise.
//
// One-way, deliberately. Pulling would let a spreadsheet edit rewrite a batch
// quantity, and batch quantity is a claim about physical stock on a shelf — the
// last thing that should be editable from a phone in a different app.
//
// The prescription tab carries doctor and patient names, so it is the one slice
// an owner may not want leaving the counter machine. It is included because a
// Schedule H register that only exists in one browser is a register waiting to
// be lost, but the Settings screen says plainly what each tab contains.

import type { Business } from "@/lib/pos/types";
import {
  FORM_LABELS,
  SCHEDULE_LABELS,
  formatExpiry,
  type Batch,
  type Customer,
  type Medicine,
  type PharmacySettings,
  type Purchase,
  type PurchaseReturn,
  type Sale,
  type SaleReturn,
  type Supplier,
} from "./types";
import { saleDue } from "./calc";

type Cell = string | number | boolean;
type TabPayload = { tab: string; headers: string[]; rows: Cell[][] };

export const SHEET_TABS = {
  meta: "Meta",
  medicines: "Medicines",
  batches: "Batches",
  sales: "Bills",
  saleLines: "Bill Lines",
  purchases: "Purchases",
  returns: "Returns",
  prescriptions: "Schedule Register",
  customers: "Customers",
} as const;

export const SHEET_TAB_NAMES = Object.values(SHEET_TABS);

export type PharmacySnapshot = {
  business: Business | null;
  settings: PharmacySettings;
  medicines: Medicine[];
  batches: Batch[];
  suppliers: Supplier[];
  purchases: Purchase[];
  sales: Sale[];
  saleReturns: SaleReturn[];
  purchaseReturns: PurchaseReturn[];
  customers: Customer[];
};

function nameOf<T extends { id: string; name: string }>(rows: T[], id: string | null): string {
  if (!id) return "";
  return rows.find((row) => row.id === id)?.name ?? "";
}

function metaTab(snapshot: PharmacySnapshot): TabPayload {
  const { business, settings } = snapshot;
  return {
    tab: SHEET_TABS.meta,
    headers: ["Field", "Value"],
    rows: [
      ["Shop", business?.name ?? ""],
      ["Phone", business?.phone ?? ""],
      ["Drug licence", settings.drugLicenceNo],
      ["GSTIN", settings.gstin],
      ["Medicines", snapshot.medicines.length],
      ["Batches in stock", snapshot.batches.filter((batch) => batch.quantity > 0).length],
      ["Bills", snapshot.sales.length],
      ["Purchases", snapshot.purchases.length],
      ["Exported at", new Date().toISOString()],
    ],
  };
}

function medicinesTab(snapshot: PharmacySnapshot): TabPayload {
  return {
    tab: SHEET_TABS.medicines,
    headers: [
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
      "Active",
    ],
    rows: snapshot.medicines.map((medicine) => [
      medicine.name,
      medicine.composition,
      medicine.manufacturer,
      medicine.strength,
      FORM_LABELS[medicine.form],
      medicine.packSize,
      medicine.packLabel,
      medicine.hsnCode,
      medicine.taxRate,
      SCHEDULE_LABELS[medicine.schedule],
      medicine.rack,
      medicine.barcode,
      medicine.lowStockAt,
      medicine.active,
    ]),
  };
}

function batchesTab(snapshot: PharmacySnapshot): TabPayload {
  return {
    tab: SHEET_TABS.batches,
    headers: [
      "Medicine",
      "Batch no",
      "Expiry",
      "Quantity",
      "MRP",
      "Selling rate",
      "Purchase rate",
      "Effective cost",
      "Supplier",
      "Value at cost",
    ],
    rows: snapshot.batches
      .filter((batch) => batch.quantity > 0)
      .map((batch) => [
        nameOf(snapshot.medicines, batch.medicineId),
        batch.batchNo,
        formatExpiry(batch.expiry),
        batch.quantity,
        batch.mrp,
        batch.sellingRate,
        batch.purchaseRate,
        batch.effectiveRate,
        nameOf(snapshot.suppliers, batch.supplierId),
        Number((batch.effectiveRate * batch.quantity).toFixed(2)),
      ]),
  };
}

function salesTab(snapshot: PharmacySnapshot): TabPayload {
  return {
    tab: SHEET_TABS.sales,
    headers: [
      "Invoice",
      "Date",
      "Customer",
      "Items",
      "Discount",
      "Tax",
      "Total",
      "Paid",
      "Balance",
      "Payment mode",
    ],
    rows: snapshot.sales.map((sale) => [
      sale.invoiceNo,
      sale.date,
      nameOf(snapshot.customers, sale.customerId),
      sale.lines.length,
      sale.discount,
      sale.taxTotal,
      sale.total,
      sale.paid,
      saleDue(sale),
      sale.paymentMode,
    ]),
  };
}

function saleLinesTab(snapshot: PharmacySnapshot): TabPayload {
  const rows: Cell[][] = [];
  for (const sale of snapshot.sales) {
    for (const line of sale.lines) {
      rows.push([
        sale.invoiceNo,
        sale.date,
        line.name,
        line.batchNo,
        formatExpiry(line.expiry),
        line.quantity,
        line.mrp,
        line.rate,
        line.discountPct,
        line.taxRate,
        line.amount,
      ]);
    }
  }
  return {
    tab: SHEET_TABS.saleLines,
    headers: [
      "Invoice",
      "Date",
      "Medicine",
      "Batch",
      "Expiry",
      "Qty",
      "MRP",
      "Rate",
      "Disc %",
      "Tax %",
      "Amount",
    ],
    rows,
  };
}

function purchasesTab(snapshot: PharmacySnapshot): TabPayload {
  return {
    tab: SHEET_TABS.purchases,
    headers: ["Invoice", "Date", "Supplier", "Lines", "Discount", "Tax", "Total", "Paid", "Outstanding"],
    rows: snapshot.purchases.map((purchase) => [
      purchase.invoiceNo,
      purchase.date,
      nameOf(snapshot.suppliers, purchase.supplierId),
      purchase.lines.length,
      purchase.discount,
      purchase.taxTotal,
      purchase.total,
      purchase.paid,
      Number(Math.max(0, purchase.total - purchase.paid).toFixed(2)),
    ]),
  };
}

function returnsTab(snapshot: PharmacySnapshot): TabPayload {
  const rows: Cell[][] = [
    ...snapshot.saleReturns.map((row) => [
      "Sale return",
      row.saleInvoiceNo,
      row.date,
      "",
      row.reason,
      row.total,
    ]),
    ...snapshot.purchaseReturns.map((row) => [
      "Purchase return",
      row.noteNo,
      row.date,
      nameOf(snapshot.suppliers, row.supplierId),
      row.reason,
      row.total,
    ]),
  ];
  return {
    tab: SHEET_TABS.returns,
    headers: ["Kind", "Reference", "Date", "Supplier", "Reason", "Total"],
    rows,
  };
}

/**
 * The scheduled-sales register.
 *
 * Only bills that actually captured a prescription appear, which is the same
 * set the printed register shows — a row with no doctor on it would be noise in
 * a document whose whole purpose is to show that the doctor was recorded.
 */
function prescriptionsTab(snapshot: PharmacySnapshot): TabPayload {
  const medicineById = new Map(snapshot.medicines.map((medicine) => [medicine.id, medicine]));
  const rows: Cell[][] = [];
  for (const sale of snapshot.sales) {
    if (!sale.prescription) continue;
    for (const line of sale.lines) {
      const schedule = medicineById.get(line.medicineId)?.schedule ?? "";
      if (!schedule) continue;
      rows.push([
        sale.date,
        sale.invoiceNo,
        sale.prescription.patientName,
        sale.prescription.doctorName,
        sale.prescription.doctorRegNo,
        line.name,
        SCHEDULE_LABELS[schedule],
        line.batchNo,
        formatExpiry(line.expiry),
        line.quantity,
      ]);
    }
  }
  return {
    tab: SHEET_TABS.prescriptions,
    headers: [
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
    rows,
  };
}

function customersTab(snapshot: PharmacySnapshot): TabPayload {
  const dueByCustomer = new Map<string, number>();
  for (const sale of snapshot.sales) {
    if (!sale.customerId) continue;
    dueByCustomer.set(sale.customerId, (dueByCustomer.get(sale.customerId) ?? 0) + saleDue(sale));
  }
  return {
    tab: SHEET_TABS.customers,
    headers: ["Name", "Phone", "Email", "Address", "Balance due"],
    rows: snapshot.customers.map((customer) => [
      customer.name,
      customer.phone,
      customer.email,
      customer.address,
      Number((dueByCustomer.get(customer.id) ?? 0).toFixed(2)),
    ]),
  };
}

const BUILDERS: Record<keyof typeof SHEET_TABS, (snapshot: PharmacySnapshot) => TabPayload> = {
  meta: metaTab,
  medicines: medicinesTab,
  batches: batchesTab,
  sales: salesTab,
  saleLines: saleLinesTab,
  purchases: purchasesTab,
  returns: returnsTab,
  prescriptions: prescriptionsTab,
  customers: customersTab,
};

export type SyncSlice = keyof typeof SHEET_TABS;

export const ALL_SYNC_SLICES: SyncSlice[] = Object.keys(BUILDERS) as SyncSlice[];

export function buildTabPayloads(
  snapshot: PharmacySnapshot,
  slices: SyncSlice[] = ALL_SYNC_SLICES
): TabPayload[] {
  return slices.map((slice) => BUILDERS[slice](snapshot));
}

/**
 * Accept the Apps Script https URL, plus http://localhost for advanced users
 * pointing at a local proxy (and for testing).
 */
export function isValidSyncUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    /^https:\/\//.test(trimmed) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(trimmed)
  );
}

async function postToScript(url: string, payload: unknown): Promise<unknown> {
  // text/plain keeps this a "simple" request (no CORS preflight, which Apps
  // Script cannot answer). Deployed with access "Anyone", the response carries
  // Access-Control-Allow-Origin: * and is readable.
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow",
  });
  try {
    return await response.json();
  } catch {
    return { ok: response.ok };
  }
}

export async function testSheetConnection(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = (await postToScript(url, { action: "test", app: "setu-pharmacy" })) as {
      ok?: boolean;
      error?: string;
    };
    if (result && result.ok === false) {
      return { ok: false, error: result.error || "The script reported an error." };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        'Could not reach the script. Check the URL, and make sure the deployment\'s access is set to "Anyone".',
    };
  }
}

export async function pushToSheet(url: string, snapshot: PharmacySnapshot): Promise<void> {
  const tabs = buildTabPayloads(snapshot);
  const result = (await postToScript(url, { action: "push", app: "setu-pharmacy", tabs })) as {
    ok?: boolean;
    error?: string;
  };
  if (result && result.ok === false) {
    throw new Error(result.error || "The sheet script rejected the update.");
  }
}

export const APPS_SCRIPT_TEMPLATE = `function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (body.action === 'test') {
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (body.action === 'push') {
    body.tabs.forEach(function (tab) {
      var sheet = ss.getSheetByName(tab.tab) || ss.insertSheet(tab.tab);
      sheet.clear();
      var rows = [tab.headers].concat(tab.rows);
      if (rows.length) {
        sheet.getRange(1, 1, rows.length, tab.headers.length).setValues(rows);
      }
    });
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Unknown action' }))
    .setMimeType(ContentService.MimeType.JSON);
}`;
