// Google Sheet sync for Free Dine.
//
// The user pastes APPS_SCRIPT_TEMPLATE into their own Google Sheet
// (Extensions → Apps Script) and deploys it as a web app. Free Dine then
// pushes whole snapshots of changed slices to that URL, and can pull the lot
// back to rebuild a browser that lost its data.
//
// This is a safety net and a reporting feed, not a live link between devices.
// Whole-tab snapshots are last-write-wins, and a round trip takes seconds — so
// two devices writing at once would lose orders, and the kitchen would be
// looking at a stale screen. Cross-tab live sync is lib/dine/sync.ts; genuine
// multi-device needs a server, which is what paid Setu Dine is for.
//
// Each tab carries human-readable columns plus a final "_json" column with the
// exact record. Pushes rewrite whole tabs (idempotent, delete-safe) and the
// restore reads only "_json", so the round trip is lossless even though the
// visible columns are rounded to rupees for a human reading the sheet.

import { toMajor } from "./money";
import { DEFAULT_DINE_SETTINGS } from "./types";
import type {
  DineArea,
  DineBill,
  DineBillItem,
  DineBillPayment,
  DineBusiness,
  DineCategory,
  DineCustomer,
  DineMenuItem,
  DineModifier,
  DineModifierGroup,
  DinePaymentMethod,
  DineSettings,
  DineSyncSlice,
  DineTable,
  DineVariation,
} from "./types";
import { DINE_BACKUP_MARKER, DINE_BACKUP_VERSION, type DineBackup } from "./backup";

export type DineMetaSnapshot = {
  business: DineBusiness | null;
  settings: DineSettings;
  categories: DineCategory[];
  areas: DineArea[];
  tables: DineTable[];
  paymentMethods: DinePaymentMethod[];
};

export type DineWorkspaceSnapshot = DineMetaSnapshot & {
  menuItems: DineMenuItem[];
  variations: DineVariation[];
  modifierGroups: DineModifierGroup[];
  modifiers: DineModifier[];
  customers: DineCustomer[];
  bills: DineBill[];
  billItems: DineBillItem[];
  billPayments: DineBillPayment[];
};

type TabPayload = { tab: string; headers: string[]; rows: (string | number | boolean)[][] };

export const DINE_SHEET_TABS = {
  meta: "Meta",
  menu: "Menu",
  menuOptions: "Menu Options",
  customers: "Customers",
  bills: "Bills",
  billItems: "Bill Items",
  billPayments: "Payments",
} as const;

/** Images would blow past the 50k-character cell limit, so they stay local. */
function menuItemForSync(item: DineMenuItem): DineMenuItem {
  return { ...item, imageDataUrl: "" };
}

function metaTab(meta: DineMetaSnapshot): TabPayload {
  const business = meta.business ? { ...meta.business, logoDataUrl: "" } : null;
  return {
    tab: DINE_SHEET_TABS.meta,
    headers: ["Key", "Value"],
    rows: [
      ["business", JSON.stringify(business)],
      ["settings", JSON.stringify(meta.settings)],
      ["categories", JSON.stringify(meta.categories)],
      ["areas", JSON.stringify(meta.areas)],
      ["tables", JSON.stringify(meta.tables)],
      ["paymentMethods", JSON.stringify(meta.paymentMethods)],
      ["syncedAt", new Date().toISOString()],
    ],
  };
}

function menuTab(items: DineMenuItem[], categories: DineCategory[]): TabPayload {
  const categoryName = (id: string) => categories.find((row) => row.id === id)?.name ?? "";
  return {
    tab: DINE_SHEET_TABS.menu,
    headers: [
      "Name",
      "Category",
      "Price",
      "Tax %",
      "Tax Type",
      "Food Type",
      "Available",
      "Updated At",
      "_json",
    ],
    rows: items.map((item) => [
      item.name,
      categoryName(item.categoryId),
      toMajor(item.price),
      item.taxRate ?? "",
      item.taxInclusive ? "inclusive" : "exclusive",
      item.foodType,
      item.available ? "yes" : "no",
      item.updatedAt,
      JSON.stringify(menuItemForSync(item)),
    ]),
  };
}

/**
 * Variations and modifier groups share one tab, tagged by kind.
 *
 * Three more tabs for three small child tables would make the sheet harder to
 * read, not easier, and nobody scans them by hand anyway — the "_json" column
 * is what the restore reads.
 */
function menuOptionsTab(
  variations: DineVariation[],
  groups: DineModifierGroup[],
  modifiers: DineModifier[],
  items: DineMenuItem[]
): TabPayload {
  const itemName = (id: string) => items.find((row) => row.id === id)?.name ?? "";
  const groupName = (id: string) => groups.find((row) => row.id === id)?.name ?? "";

  const rows: (string | number | boolean)[][] = [];
  for (const variation of variations) {
    rows.push([
      "variation",
      itemName(variation.menuItemId),
      variation.name,
      toMajor(variation.price),
      "",
      JSON.stringify(variation),
    ]);
  }
  for (const group of groups) {
    rows.push([
      "group",
      itemName(group.menuItemId),
      group.name,
      "",
      `${group.minSelect}-${group.maxSelect}`,
      JSON.stringify(group),
    ]);
  }
  for (const modifier of modifiers) {
    rows.push([
      "modifier",
      groupName(modifier.groupId),
      modifier.name,
      toMajor(modifier.priceDelta),
      "",
      JSON.stringify(modifier),
    ]);
  }

  return {
    tab: DINE_SHEET_TABS.menuOptions,
    headers: ["Kind", "Belongs To", "Name", "Price", "Limits", "_json"],
    rows,
  };
}

function customersTab(customers: DineCustomer[]): TabPayload {
  return {
    tab: DINE_SHEET_TABS.customers,
    headers: ["Name", "Phone", "Email", "Address", "Notes", "Created At", "_json"],
    rows: customers.map((customer) => [
      customer.name,
      customer.phone,
      customer.email,
      customer.address,
      customer.notes,
      customer.createdAt,
      JSON.stringify(customer),
    ]),
  };
}

function billsTab(bills: DineBill[]): TabPayload {
  return {
    tab: DINE_SHEET_TABS.bills,
    headers: [
      "Bill",
      "Business Date",
      "Date",
      "Order Type",
      "Table",
      "Customer",
      "Subtotal",
      "Discount",
      "Service Charge",
      "Tax",
      "Total",
      "Status",
      "_json",
    ],
    rows: bills.map((bill) => [
      bill.billLabel,
      bill.businessDate,
      bill.createdAt,
      bill.orderType,
      bill.tableName,
      bill.customerName,
      toMajor(bill.subtotal),
      toMajor(bill.discountAmount),
      toMajor(bill.serviceCharge + bill.serviceChargeTax),
      toMajor(bill.addedTax),
      toMajor(bill.total),
      bill.status,
      JSON.stringify(bill),
    ]),
  };
}

function billItemsTab(items: DineBillItem[], bills: DineBill[]): TabPayload {
  const label = (id: string) => bills.find((row) => row.id === id)?.billLabel ?? "";
  return {
    tab: DINE_SHEET_TABS.billItems,
    headers: ["Bill", "Item", "Variation", "Modifiers", "Qty", "Unit Price", "Line Total", "_json"],
    rows: items.map((item) => [
      label(item.billId),
      item.name,
      item.variationName,
      item.modifiers.map((modifier) => modifier.name).join(", "),
      item.quantity,
      toMajor(item.unitPrice),
      toMajor(item.lineTotal),
      JSON.stringify(item),
    ]),
  };
}

function billPaymentsTab(payments: DineBillPayment[], bills: DineBill[]): TabPayload {
  const label = (id: string) => bills.find((row) => row.id === id)?.billLabel ?? "";
  return {
    tab: DINE_SHEET_TABS.billPayments,
    headers: ["Bill", "Method", "Amount", "Note", "Paid At", "_json"],
    rows: payments.map((payment) => [
      label(payment.billId),
      payment.methodName,
      toMajor(payment.amount),
      payment.note,
      payment.createdAt,
      JSON.stringify(payment),
    ]),
  };
}

export function buildDineTabPayloads(
  snapshot: DineWorkspaceSnapshot,
  slices: DineSyncSlice[]
): TabPayload[] {
  const tabs: TabPayload[] = [];
  if (slices.includes("meta")) tabs.push(metaTab(snapshot));
  if (slices.includes("menu")) {
    tabs.push(menuTab(snapshot.menuItems, snapshot.categories));
    tabs.push(
      menuOptionsTab(
        snapshot.variations,
        snapshot.modifierGroups,
        snapshot.modifiers,
        snapshot.menuItems
      )
    );
  }
  if (slices.includes("customers")) tabs.push(customersTab(snapshot.customers));
  if (slices.includes("bills")) {
    tabs.push(billsTab(snapshot.bills));
    tabs.push(billItemsTab(snapshot.billItems, snapshot.bills));
    tabs.push(billPaymentsTab(snapshot.billPayments, snapshot.bills));
  }
  return tabs;
}

/**
 * Accept the Apps Script https URL, plus http://localhost for advanced users
 * pointing at a local proxy or self-hosted endpoint (and for testing).
 */
export function isValidSyncUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    /^https:\/\//.test(trimmed) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(trimmed)
  );
}

async function postToScript(url: string, payload: unknown): Promise<unknown> {
  // text/plain keeps this a "simple" request (no CORS preflight, which Apps
  // Script cannot answer). Deployed with access "Anyone", the final response
  // carries Access-Control-Allow-Origin: * and is readable.
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow",
  });
  try {
    return await response.json();
  } catch {
    // Some environments return an unreadable body; the write itself succeeded
    // if the request resolved.
    return { ok: response.ok };
  }
}

export async function testDineSheetConnection(
  url: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = (await postToScript(url, { action: "test", app: "setu-dine" })) as {
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

export async function pushToDineSheet(url: string, tabs: TabPayload[]): Promise<void> {
  const result = (await postToScript(url, { action: "push", app: "setu-dine", tabs })) as {
    ok?: boolean;
    error?: string;
  };
  if (result && result.ok === false) {
    throw new Error(result.error || "The sheet script rejected the update.");
  }
}

export type DineSheetPullResult = {
  meta: Partial<DineMetaSnapshot>;
  menuItems: DineMenuItem[];
  variations: DineVariation[];
  modifierGroups: DineModifierGroup[];
  modifiers: DineModifier[];
  customers: DineCustomer[];
  bills: DineBill[];
  billItems: DineBillItem[];
  billPayments: DineBillPayment[];
};

function parseJsonColumn<T>(rows: unknown[][]): T[] {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const headers = rows[0] as string[];
  const jsonIndex = headers.indexOf("_json");
  if (jsonIndex === -1) return [];
  const records: T[] = [];
  for (const row of rows.slice(1)) {
    const cell = row[jsonIndex];
    if (typeof cell !== "string" || !cell) continue;
    try {
      records.push(JSON.parse(cell) as T);
    } catch {
      // Skip a corrupted row rather than failing the whole restore.
    }
  }
  return records;
}

/** Split the shared options tab back into its three record types. */
function parseOptions(rows: unknown[][]) {
  if (!Array.isArray(rows) || rows.length < 2) {
    return { variations: [], groups: [], modifiers: [] };
  }
  const headers = rows[0] as string[];
  const kindIndex = headers.indexOf("Kind");
  const jsonIndex = headers.indexOf("_json");
  const variations: DineVariation[] = [];
  const groups: DineModifierGroup[] = [];
  const modifiers: DineModifier[] = [];
  if (kindIndex === -1 || jsonIndex === -1) return { variations, groups, modifiers };

  for (const row of rows.slice(1)) {
    const cell = row[jsonIndex];
    if (typeof cell !== "string" || !cell) continue;
    try {
      const record = JSON.parse(cell);
      const kind = String(row[kindIndex] ?? "");
      if (kind === "variation") variations.push(record as DineVariation);
      else if (kind === "group") groups.push(record as DineModifierGroup);
      else if (kind === "modifier") modifiers.push(record as DineModifier);
    } catch {
      // Skip corrupted rows.
    }
  }
  return { variations, groups, modifiers };
}

export async function pullFromDineSheet(url: string): Promise<DineSheetPullResult> {
  const separator = url.includes("?") ? "&" : "?";
  const response = await fetch(`${url}${separator}action=pull`, { redirect: "follow" });
  const body = (await response.json()) as {
    ok?: boolean;
    error?: string;
    tabs?: Record<string, unknown[][]>;
  };
  if (!body || body.ok === false || !body.tabs) {
    throw new Error(body?.error || "The script did not return any restaurant data.");
  }

  const meta: Partial<DineMetaSnapshot> = {};
  const metaRows = body.tabs[DINE_SHEET_TABS.meta];
  if (Array.isArray(metaRows)) {
    for (const row of metaRows) {
      const [key, value] = row as [string, string];
      if (typeof value !== "string" || !value) continue;
      try {
        if (key === "business") meta.business = JSON.parse(value);
        if (key === "settings") meta.settings = JSON.parse(value);
        if (key === "categories") meta.categories = JSON.parse(value);
        if (key === "areas") meta.areas = JSON.parse(value);
        if (key === "tables") meta.tables = JSON.parse(value);
        if (key === "paymentMethods") meta.paymentMethods = JSON.parse(value);
      } catch {
        // Ignore a corrupted meta entry.
      }
    }
  }

  const options = parseOptions(body.tabs[DINE_SHEET_TABS.menuOptions] ?? []);

  return {
    meta,
    menuItems: parseJsonColumn<DineMenuItem>(body.tabs[DINE_SHEET_TABS.menu] ?? []),
    variations: options.variations,
    modifierGroups: options.groups,
    modifiers: options.modifiers,
    customers: parseJsonColumn<DineCustomer>(body.tabs[DINE_SHEET_TABS.customers] ?? []),
    bills: parseJsonColumn<DineBill>(body.tabs[DINE_SHEET_TABS.bills] ?? []),
    billItems: parseJsonColumn<DineBillItem>(body.tabs[DINE_SHEET_TABS.billItems] ?? []),
    billPayments: parseJsonColumn<DineBillPayment>(body.tabs[DINE_SHEET_TABS.billPayments] ?? []),
  };
}

/**
 * Turn a sheet pull into a normal Dine backup so the restore path is shared.
 *
 * Ticket and KOT stores are deliberately absent from the payload: restore only
 * clears the stores a backup actually carries, so a sheet restore rebuilds the
 * menu, the floor and the sales history while leaving whatever is open on the
 * pass alone.
 */
export function buildBackupFromDineSheetPull(
  pull: DineSheetPullResult,
  url: string
): DineBackup {
  if (!pull.meta.business || typeof pull.meta.business.name !== "string") {
    throw new Error(
      "This sheet has no synced restaurant profile yet. Connect Free Dine to it and sync at least once first."
    );
  }
  const settings: DineSettings = pull.meta.settings
    ? { ...DEFAULT_DINE_SETTINGS, ...pull.meta.settings, sheetSyncUrl: url }
    : { ...DEFAULT_DINE_SETTINGS, sheetSyncUrl: url };

  return {
    app: DINE_BACKUP_MARKER,
    version: DINE_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      dine_business: [pull.meta.business],
      dine_settings: [settings],
      dine_categories: pull.meta.categories ?? [],
      dine_areas: pull.meta.areas ?? [],
      dine_tables: pull.meta.tables ?? [],
      dine_payment_methods: pull.meta.paymentMethods ?? [],
      dine_menu_items: pull.menuItems,
      dine_variations: pull.variations,
      dine_modifier_groups: pull.modifierGroups,
      dine_modifiers: pull.modifiers,
      dine_customers: pull.customers,
      dine_bills: pull.bills,
      dine_bill_items: pull.billItems,
      dine_bill_payments: pull.billPayments,
    },
  };
}

// ---------------------------------------------------------------------------
// The script users paste into their Google Sheet (Extensions → Apps Script).
// Kept free of backticks/template literals so it embeds cleanly here.
// ---------------------------------------------------------------------------
export const APPS_SCRIPT_TEMPLATE = `// Setu Free Dine — Google Sheet sync script (v1)
// 1. In your Google Sheet: Extensions -> Apps Script, replace everything with this file.
// 2. Click Deploy -> New deployment -> type: Web app.
//    - Execute as: Me
//    - Who has access: Anyone
// 3. Copy the Web app URL and paste it into Free Dine (Settings -> Google Sheet sync).
// Treat that URL like the share link of this sheet.

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "";
  if (action === "pull") return respond_(pullAll_());
  return respond_({ ok: true, app: "setu-dine-sheet-sync", version: 1 });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === "test") {
      writeTab_("Meta", [["Key", "Value"], ["connectedAt", new Date().toISOString()]], true);
      return respond_({ ok: true, sheet: SpreadsheetApp.getActive().getName() });
    }
    if (body.action === "push") {
      var tabs = body.tabs || [];
      for (var i = 0; i < tabs.length; i++) {
        var t = tabs[i];
        var values = [t.headers].concat(t.rows || []);
        writeTab_(t.tab, values, false);
      }
      return respond_({ ok: true, updated: tabs.length });
    }
    if (body.action === "pull") return respond_(pullAll_());
    return respond_({ ok: false, error: "Unknown action" });
  } catch (err) {
    return respond_({ ok: false, error: String(err) });
  }
}

function writeTab_(name, values, keepExisting) {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (!keepExisting) sheet.clearContents();
  if (values.length === 0) return;
  var width = 0;
  for (var i = 0; i < values.length; i++) {
    if (values[i].length > width) width = values[i].length;
  }
  for (var j = 0; j < values.length; j++) {
    while (values[j].length < width) values[j].push("");
  }
  sheet.getRange(1, 1, values.length, width).setValues(values);
}

function pullAll_() {
  var names = ["Meta", "Menu", "Menu Options", "Customers", "Bills", "Bill Items", "Payments"];
  var ss = SpreadsheetApp.getActive();
  var tabs = {};
  for (var i = 0; i < names.length; i++) {
    var sheet = ss.getSheetByName(names[i]);
    tabs[names[i]] = sheet ? sheet.getDataRange().getValues() : [];
  }
  return { ok: true, app: "setu-dine-sheet-sync", tabs: tabs };
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
`;
