// Google Sheet sync for the rental book.
//
// Same protocol as the POS, tuition, clinic and queue syncs: the owner pastes
// the Apps Script into their own Google Sheet, deploys it as a web app, and
// this pushes whole-tab snapshots to that URL. Off until a URL is pasted;
// nothing leaves the device otherwise.
//
// One-way, like the queue's. Pulling would let a spreadsheet edit rewrite a
// live booking, and a booking is a promise about physical stock on a date —
// the last thing that should be editable from a phone in a different app.

import type { Business } from "@/lib/pos/types";
import {
  BOOKING_STATUS_LABELS,
  MAINTENANCE_KIND_LABELS,
  RATE_BASIS_LABELS,
  type Booking,
  type Customer,
  type ItemCategory,
  type ItemUnit,
  type MaintenanceLog,
  type RentalItem,
  type RentalSettings,
} from "./types";
import { depositRegister, utilisationByItem } from "./reports";
import { todayKey, addDays } from "./types";

type TabPayload = { tab: string; headers: string[]; rows: (string | number | boolean)[][] };

export const SHEET_TABS = {
  meta: "Meta",
  bookings: "Bookings",
  lines: "Booking Lines",
  items: "Items",
  customers: "Customers",
  utilisation: "Utilisation",
  deposits: "Deposits Held",
  maintenance: "Maintenance",
} as const;

export const SHEET_TAB_NAMES = Object.values(SHEET_TABS);

export type RentalSnapshot = {
  business: Business | null;
  settings: RentalSettings;
  categories: ItemCategory[];
  items: RentalItem[];
  units: ItemUnit[];
  customers: Customer[];
  bookings: Booking[];
  maintenanceLogs: MaintenanceLog[];
};

export type SyncSlice = keyof typeof SHEET_TABS;

export const ALL_SYNC_SLICES: SyncSlice[] = [
  "meta",
  "bookings",
  "lines",
  "items",
  "customers",
  "utilisation",
  "deposits",
  "maintenance",
];

function customerName(snapshot: RentalSnapshot, id: string): string {
  return snapshot.customers.find((customer) => customer.id === id)?.name ?? "";
}

function metaTab(snapshot: RentalSnapshot): TabPayload {
  const { business, settings } = snapshot;
  return {
    tab: SHEET_TABS.meta,
    headers: ["Field", "Value"],
    rows: [
      ["Business", business?.name ?? ""],
      ["Phone", business?.phone ?? ""],
      ["Items", snapshot.items.length],
      ["Customers", snapshot.customers.length],
      ["Bookings", snapshot.bookings.length],
      ["Buffer days", settings.bufferDays],
      ["Minimum advance %", settings.minAdvancePercent],
      ["Return day charged", settings.countReturnDay],
      ["Exported at", new Date().toISOString()],
    ],
  };
}

function bookingsTab(snapshot: RentalSnapshot): TabPayload {
  return {
    tab: SHEET_TABS.bookings,
    headers: [
      "Booking no",
      "Status",
      "Customer",
      "Event",
      "Venue",
      "From",
      "To",
      "Returned on",
      "Total",
      "Deposit",
      "Advance",
      "Late days",
      "Late fee",
      "Damage",
      "Loss",
      "Paid",
      "Balance",
    ],
    rows: snapshot.bookings.map((booking) => [
      booking.bookingNo,
      BOOKING_STATUS_LABELS[booking.status],
      customerName(snapshot, booking.customerId),
      booking.eventName,
      booking.venue,
      booking.fromDate,
      booking.toDate,
      booking.actualReturnedOn ?? "",
      booking.total,
      booking.depositTotal,
      booking.advancePaid,
      booking.lateDays,
      booking.lateFee,
      booking.damageTotal,
      booking.lossTotal,
      booking.paid,
      booking.finalPayable,
    ]),
  };
}

function linesTab(snapshot: RentalSnapshot): TabPayload {
  return {
    tab: SHEET_TABS.lines,
    headers: [
      "Booking no",
      "From",
      "To",
      "Item",
      "Qty",
      "Rate",
      "Basis",
      "Units",
      "Amount",
      "Returned",
      "Damaged",
      "Lost",
    ],
    rows: snapshot.bookings.flatMap((booking) =>
      booking.lines.map((line) => [
        booking.bookingNo,
        booking.fromDate,
        booking.toDate,
        line.name,
        line.quantity,
        line.rate,
        RATE_BASIS_LABELS[line.rateBasis],
        line.chargeableUnits,
        line.amount,
        line.returnedQuantity,
        line.damagedQuantity,
        line.lostQuantity,
      ])
    ),
  };
}

function itemsTab(snapshot: RentalSnapshot): TabPayload {
  const categoryName = (id: string) =>
    snapshot.categories.find((category) => category.id === id)?.name ?? "";
  return {
    tab: SHEET_TABS.items,
    headers: [
      "Item",
      "Category",
      "Tracking",
      "Owned",
      "Rate",
      "Basis",
      "Min order qty",
      "Min advance %",
      "Deposit/unit",
      "Replacement value",
      "Purchase cost",
      "Active",
    ],
    rows: snapshot.items.map((item) => [
      item.name,
      categoryName(item.categoryId),
      item.tracking,
      item.totalQuantity,
      item.rate,
      RATE_BASIS_LABELS[item.rateBasis],
      item.minOrderQuantity,
      item.minAdvancePercent === null ? "" : item.minAdvancePercent,
      item.depositPerUnit,
      item.replacementValue,
      item.purchaseCost,
      item.active,
    ]),
  };
}

function customersTab(snapshot: RentalSnapshot): TabPayload {
  return {
    tab: SHEET_TABS.customers,
    headers: ["Name", "Phone", "Alt phone", "Address", "Trade", "ID proof", "Notes"],
    rows: snapshot.customers.map((customer) => [
      customer.name,
      customer.phone,
      customer.altPhone,
      customer.address,
      customer.isTrade,
      [customer.idProofKind, customer.idProofNumber].filter(Boolean).join(" "),
      customer.notes,
    ]),
  };
}

function utilisationTab(snapshot: RentalSnapshot): TabPayload {
  const period = { from: addDays(todayKey(), -89), to: todayKey() };
  const rows = utilisationByItem(
    snapshot.items,
    snapshot.bookings,
    snapshot.maintenanceLogs,
    period,
    snapshot.settings
  );
  return {
    tab: SHEET_TABS.utilisation,
    headers: ["Item", "Owned", "Unit-days out", "Utilisation %", "Revenue", "Bookings"],
    rows: rows.map((row) => [
      row.item.name,
      row.item.totalQuantity,
      row.unitDaysOut,
      Math.round(row.utilisation * 100),
      row.revenue,
      row.bookings,
    ]),
  };
}

function depositsTab(snapshot: RentalSnapshot): TabPayload {
  return {
    tab: SHEET_TABS.deposits,
    headers: ["Booking no", "Customer", "Due back", "Deposit held", "Status"],
    rows: depositRegister(snapshot.bookings).map((booking) => [
      booking.bookingNo,
      customerName(snapshot, booking.customerId),
      booking.toDate,
      booking.depositTotal,
      BOOKING_STATUS_LABELS[booking.status],
    ]),
  };
}

function maintenanceTab(snapshot: RentalSnapshot): TabPayload {
  const itemName = (id: string) => snapshot.items.find((item) => item.id === id)?.name ?? "";
  return {
    tab: SHEET_TABS.maintenance,
    headers: ["Date", "Item", "Kind", "Qty", "Description", "Cost", "Out from", "Out to"],
    rows: snapshot.maintenanceLogs.map((log) => [
      log.date,
      itemName(log.itemId),
      MAINTENANCE_KIND_LABELS[log.kind],
      log.quantity,
      log.description,
      log.cost,
      log.outOfServiceFrom ?? "",
      log.outOfServiceTo ?? "",
    ]),
  };
}

const BUILDERS: Record<SyncSlice, (snapshot: RentalSnapshot) => TabPayload> = {
  meta: metaTab,
  bookings: bookingsTab,
  lines: linesTab,
  items: itemsTab,
  customers: customersTab,
  utilisation: utilisationTab,
  deposits: depositsTab,
  maintenance: maintenanceTab,
};

export function buildTabPayloads(
  snapshot: RentalSnapshot,
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
    const result = (await postToScript(url, { action: "test", app: "setu-rental" })) as {
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
  const result = (await postToScript(url, { action: "push", app: "setu-rental", tabs })) as {
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
