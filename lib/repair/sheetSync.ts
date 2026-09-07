// Google Sheet sync for the job card.
//
// Same protocol as the POS, tuition, clinic, queue and rental syncs: the owner
// pastes the Apps Script into their own Google Sheet, deploys it as a web app,
// and this pushes whole-tab snapshots to that URL. Off until a URL is pasted;
// nothing leaves the device otherwise.
//
// One-way, like the others. And narrower than the others on purpose: the intake
// record — photos, signature, unlock code — is never pushed. A spreadsheet is
// shared with an accountant and left open on a laptop, and none of those three
// things should travel anywhere the shop did not carry them deliberately.

import type { Business } from "@/lib/pos/types";
import {
  DEVICE_KIND_LABELS,
  JOB_STATUS_LABELS,
  dateKeyOf,
  deviceLabel,
  todayKey,
  type Bill,
  type Customer,
  type Job,
  type Part,
  type RepairSettings,
  type Technician,
} from "./types";
import {
  billTotals,
  daysInShop,
  jobMargin,
  turnaroundDays,
  warrantyEndOf,
} from "./calc";
import { billsByJob, uncollectedDevices } from "./reports";

type TabPayload = { tab: string; headers: string[]; rows: (string | number | boolean)[][] };

export const SHEET_TABS = {
  meta: "Meta",
  jobs: "Jobs",
  parts: "Parts Used",
  stock: "Parts Stock",
  customers: "Customers",
  bills: "Bills",
  uncollected: "Uncollected",
} as const;

export const SHEET_TAB_NAMES = Object.values(SHEET_TABS);

export type SyncSlice = keyof typeof SHEET_TABS;

export const ALL_SYNC_SLICES: SyncSlice[] = [
  "meta",
  "jobs",
  "parts",
  "stock",
  "customers",
  "bills",
  "uncollected",
];

export type RepairSnapshot = {
  business: Business | null;
  settings: RepairSettings;
  customers: Customer[];
  jobs: Job[];
  parts: Part[];
  technicians: Technician[];
  bills: Bill[];
};

const BUILDERS: Record<SyncSlice, (snapshot: RepairSnapshot) => TabPayload> = {
  meta: (snapshot) => ({
    tab: SHEET_TABS.meta,
    headers: ["Field", "Value"],
    rows: [
      ["Shop", snapshot.business?.name ?? ""],
      ["Phone", snapshot.business?.phone ?? ""],
      ["Pushed at", new Date().toISOString()],
      ["Jobs", snapshot.jobs.length],
      ["Customers", snapshot.customers.length],
      ["Parts", snapshot.parts.length],
      ["Note", "Intake photos, signatures and unlock codes are never synced."],
    ],
  }),

  jobs: (snapshot) => {
    const techById = new Map(snapshot.technicians.map((tech) => [tech.id, tech.name]));
    const nameById = new Map(snapshot.customers.map((customer) => [customer.id, customer.name]));
    const phoneById = new Map(snapshot.customers.map((customer) => [customer.id, customer.phone]));
    const billFor = billsByJob(snapshot.bills);
    return {
      tab: SHEET_TABS.jobs,
      headers: [
        "Job no",
        "Status",
        "Received on",
        "Days in shop",
        "Customer",
        "Phone",
        "Device",
        "Kind",
        "Serial / IMEI",
        "Problem",
        "Technician",
        "Priority",
        "Promised",
        "Estimate",
        "Total",
        "Margin",
        "Delivered on",
        "Turnaround",
        "Warranty until",
      ],
      rows: snapshot.jobs.map((job) => {
        const bill = billFor.get(job.id) ?? null;
        return [
          job.jobNo,
          JOB_STATUS_LABELS[job.status],
          dateKeyOf(job.createdAt),
          daysInShop(job),
          nameById.get(job.customerId) ?? "",
          phoneById.get(job.customerId) ?? "",
          deviceLabel(job),
          DEVICE_KIND_LABELS[job.deviceKind],
          job.serialNo,
          job.reportedProblems.join("; "),
          job.technicianId ? (techById.get(job.technicianId) ?? "") : "",
          job.priority,
          job.promisedDate ?? "",
          job.estimateAmount ?? "",
          bill ? bill.total : billTotals(job, snapshot.settings).total,
          jobMargin(job, bill, snapshot.settings),
          job.deliveredOn ?? "",
          turnaroundDays(job) ?? "",
          warrantyEndOf(job),
        ];
      }),
    };
  },

  parts: (snapshot) => ({
    tab: SHEET_TABS.parts,
    headers: [
      "Job no",
      "Received on",
      "Part",
      "Qty",
      "Cost",
      "Selling",
      "Cost total",
      "Selling total",
    ],
    rows: snapshot.jobs.flatMap((job) =>
      job.partsUsed.map((part) => [
        job.jobNo,
        dateKeyOf(job.createdAt),
        part.name,
        part.quantity,
        part.costPrice,
        part.sellingPrice,
        part.costPrice * part.quantity,
        part.sellingPrice * part.quantity,
      ])
    ),
  }),

  stock: (snapshot) => ({
    tab: SHEET_TABS.stock,
    headers: [
      "Part",
      "SKU",
      "Compatible with",
      "Cost",
      "Selling",
      "Stock",
      "Low at",
      "Value at cost",
      "Supplier",
    ],
    rows: snapshot.parts.map((part) => [
      part.name,
      part.sku,
      part.compatibleWith,
      part.costPrice,
      part.sellingPrice,
      part.stock,
      part.lowStockAt,
      part.costPrice * part.stock,
      part.supplierName,
    ]),
  }),

  customers: (snapshot) => ({
    tab: SHEET_TABS.customers,
    headers: ["Name", "Phone", "Alt phone", "Company", "GSTIN", "Jobs"],
    rows: snapshot.customers.map((customer) => [
      customer.name,
      customer.phone,
      customer.altPhone,
      customer.companyName,
      customer.gstin,
      snapshot.jobs.filter((job) => job.customerId === customer.id).length,
    ]),
  }),

  bills: (snapshot) => {
    const jobNoById = new Map(snapshot.jobs.map((job) => [job.id, job.jobNo]));
    const nameById = new Map(snapshot.customers.map((customer) => [customer.id, customer.name]));
    return {
      tab: SHEET_TABS.bills,
      headers: [
        "Invoice no",
        "Date",
        "Job no",
        "Customer",
        "Labour",
        "Discount",
        "Tax",
        "Total",
        "Paid",
        "Balance",
        "Mode",
      ],
      rows: snapshot.bills.map((bill) => [
        bill.invoiceNo,
        bill.date,
        jobNoById.get(bill.jobId) ?? "",
        nameById.get(bill.customerId) ?? "",
        bill.labourCharge,
        bill.discount,
        bill.taxAmount,
        bill.total,
        bill.paid,
        Math.max(0, bill.total - bill.paid),
        bill.paymentMode,
      ]),
    };
  },

  uncollected: (snapshot) => {
    const { rows } = uncollectedDevices(
      snapshot.jobs,
      snapshot.bills,
      snapshot.settings,
      todayKey()
    );
    const customerById = new Map(snapshot.customers.map((customer) => [customer.id, customer]));
    return {
      tab: SHEET_TABS.uncollected,
      headers: ["Job no", "Device", "Customer", "Phone", "Ready since", "Days", "Value"],
      rows: rows.map((row) => {
        const customer = customerById.get(row.job.customerId);
        return [
          row.job.jobNo,
          deviceLabel(row.job),
          customer?.name ?? "",
          customer?.phone ?? "",
          row.readySince,
          row.days,
          row.value,
        ];
      }),
    };
  },
};

export function buildTabPayloads(
  snapshot: RepairSnapshot,
  slices: SyncSlice[]
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
    const result = (await postToScript(url, { action: "test", app: "setu-repair" })) as {
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

export async function pushToSheet(url: string, tabs: TabPayload[]): Promise<void> {
  const result = (await postToScript(url, { action: "push", app: "setu-repair", tabs })) as {
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
