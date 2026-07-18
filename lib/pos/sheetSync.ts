// Google Sheet sync for the Browser Based POS.
//
// The user pastes APPS_SCRIPT_TEMPLATE into their own Google Sheet
// (Extensions → Apps Script) and deploys it as a web app. The POS then
// pushes full snapshots of changed data slices to that URL, and can pull
// everything back to restore a lost browser.
//
// Each tab stores human-readable columns plus a final "_json" column with
// the exact record — pushes rewrite whole tabs (idempotent, delete-safe)
// and restore reads only the _json column (lossless round trip).

import type {
  Business,
  Category,
  Customer,
  Order,
  OrderItem,
  PaymentMethod,
  PosSettings,
  Product,
} from "./types";
import { BACKUP_APP_MARKER, BACKUP_VERSION, type PosBackup } from "./backup";
import { DEFAULT_SETTINGS } from "./types";
import type { StoreName } from "./db";

export type MetaSnapshot = {
  business: Business | null;
  settings: PosSettings;
  categories: Category[];
  payments: PaymentMethod[];
};

export type WorkspaceSnapshot = MetaSnapshot & {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  orderItems: OrderItem[];
};

type TabPayload = { tab: string; headers: string[]; rows: (string | number | boolean)[][] };

export const SHEET_TABS = {
  meta: "Meta",
  products: "Products",
  customers: "Customers",
  orders: "Orders",
  orderItems: "Order Items",
} as const;

/** Strip fields that don't belong in a sheet cell (50k char limit). */
function productForSync(product: Product): Product {
  return { ...product, imageDataUrl: "" };
}

function productsTab(products: Product[], categories: Category[]): TabPayload {
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";
  return {
    tab: SHEET_TABS.products,
    headers: ["Name", "Category", "Selling Price", "Cost Price", "SKU", "Barcode", "Tax %", "Tax Type", "Stock", "Unit", "Updated At", "_json"],
    rows: products.map((p) => {
      const record = productForSync(p);
      return [
        p.name,
        categoryName(p.categoryId),
        p.sellingPrice,
        p.costPrice ?? "",
        p.sku,
        p.barcode,
        p.taxRate ?? "",
        p.taxInclusive ? "inclusive" : "exclusive",
        p.trackStock ? p.stock : "",
        p.unit,
        p.updatedAt,
        JSON.stringify(record),
      ];
    }),
  };
}

function customersTab(customers: Customer[]): TabPayload {
  return {
    tab: SHEET_TABS.customers,
    headers: ["Name", "Phone", "Email", "Address", "Notes", "Created At", "_json"],
    rows: customers.map((c) => [
      c.name,
      c.phone,
      c.email,
      c.address,
      c.notes,
      c.createdAt,
      JSON.stringify(c),
    ]),
  };
}

function ordersTab(orders: Order[]): TabPayload {
  return {
    tab: SHEET_TABS.orders,
    headers: ["Invoice", "Date", "Customer", "Subtotal", "Discount", "Tax", "Incl. Tax", "Total", "Payment", "Status", "_json"],
    rows: orders.map((o) => [
      o.invoiceNumber,
      o.date,
      o.customerName || "Walk-in",
      o.subtotal,
      o.discountAmount,
      o.taxAmount,
      o.includedTaxAmount ?? 0,
      o.total,
      o.paymentMethodName,
      o.status,
      JSON.stringify(o),
    ]),
  };
}

function orderItemsTab(orderItems: OrderItem[], orders: Order[]): TabPayload {
  const invoice = (orderId: string) =>
    orders.find((o) => o.id === orderId)?.invoiceNumber ?? "";
  return {
    tab: SHEET_TABS.orderItems,
    headers: ["Invoice", "Product", "Price", "Quantity", "Tax %", "Line Total", "_json"],
    rows: orderItems.map((item) => [
      invoice(item.orderId),
      item.name,
      item.price,
      item.quantity,
      item.taxRate,
      item.lineSubtotal,
      JSON.stringify(item),
    ]),
  };
}

function metaTab(meta: MetaSnapshot): TabPayload {
  return {
    tab: SHEET_TABS.meta,
    headers: ["Key", "Value"],
    rows: [
      ["business", JSON.stringify(meta.business)],
      ["settings", JSON.stringify(meta.settings)],
      ["categories", JSON.stringify(meta.categories)],
      ["payments", JSON.stringify(meta.payments)],
      ["updatedAt", new Date().toISOString()],
    ],
  };
}

export function buildTabPayloads(
  slices: string[],
  snapshot: WorkspaceSnapshot
): TabPayload[] {
  const tabs: TabPayload[] = [];
  if (slices.includes("meta")) tabs.push(metaTab(snapshot));
  if (slices.includes("products")) tabs.push(productsTab(snapshot.products, snapshot.categories));
  if (slices.includes("customers")) tabs.push(customersTab(snapshot.customers));
  if (slices.includes("orders")) {
    tabs.push(ordersTab(snapshot.orders));
    tabs.push(orderItemsTab(snapshot.orderItems, snapshot.orders));
  }
  return tabs;
}

/**
 * Accept the Apps Script https URL, plus http://localhost for advanced users
 * pointing at a local proxy/self-hosted endpoint (and for testing).
 */
export function isValidSyncUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    /^https:\/\//.test(trimmed) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(trimmed)
  );
}

async function postToScript(url: string, payload: unknown): Promise<unknown> {
  // text/plain keeps this a "simple" request (no CORS preflight, which
  // Apps Script cannot answer). Deployed with access "Anyone", the final
  // response carries Access-Control-Allow-Origin: * and is readable.
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow",
  });
  try {
    return await response.json();
  } catch {
    // Some environments return an unreadable body; the write itself
    // succeeded if the request resolved.
    return { ok: response.ok };
  }
}

export async function testSheetConnection(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = (await postToScript(url, { action: "test", app: "setu-pos" })) as {
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
        "Could not reach the script. Check the URL, and make sure the deployment's access is set to \"Anyone\".",
    };
  }
}

export async function pushToSheet(url: string, tabs: TabPayload[]): Promise<void> {
  const result = (await postToScript(url, { action: "push", app: "setu-pos", tabs })) as {
    ok?: boolean;
    error?: string;
  };
  if (result && result.ok === false) {
    throw new Error(result.error || "The sheet script rejected the update.");
  }
}

export type SheetPullResult = {
  meta: Partial<MetaSnapshot>;
  products: Product[];
  customers: Customer[];
  orders: Order[];
  orderItems: OrderItem[];
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
      // Skip corrupted rows instead of failing the whole restore.
    }
  }
  return records;
}

export async function pullFromSheet(url: string): Promise<SheetPullResult> {
  const separator = url.includes("?") ? "&" : "?";
  const response = await fetch(`${url}${separator}action=pull`, { redirect: "follow" });
  const body = (await response.json()) as {
    ok?: boolean;
    error?: string;
    tabs?: Record<string, unknown[][]>;
  };
  if (!body || body.ok === false || !body.tabs) {
    throw new Error(body?.error || "The script did not return workspace data.");
  }

  const meta: Partial<MetaSnapshot> = {};
  const metaRows = body.tabs[SHEET_TABS.meta];
  if (Array.isArray(metaRows)) {
    for (const row of metaRows) {
      const [key, value] = row as [string, string];
      if (typeof value !== "string" || !value) continue;
      try {
        if (key === "business") meta.business = JSON.parse(value);
        if (key === "settings") meta.settings = JSON.parse(value);
        if (key === "categories") meta.categories = JSON.parse(value);
        if (key === "payments") meta.payments = JSON.parse(value);
      } catch {
        // Ignore corrupted meta entries.
      }
    }
  }

  return {
    meta,
    products: parseJsonColumn<Product>(body.tabs[SHEET_TABS.products] ?? []),
    customers: parseJsonColumn<Customer>(body.tabs[SHEET_TABS.customers] ?? []),
    orders: parseJsonColumn<Order>(body.tabs[SHEET_TABS.orders] ?? []),
    orderItems: parseJsonColumn<OrderItem>(body.tabs[SHEET_TABS.orderItems] ?? []),
  };
}

/** Turn a sheet pull into a normal POS backup so the restore path is shared. */
export function buildBackupFromSheetPull(pull: SheetPullResult, url: string): PosBackup {
  if (!pull.meta.business || typeof pull.meta.business.name !== "string") {
    throw new Error(
      "This sheet has no synced business profile yet. Connect the POS to it and sync at least once first."
    );
  }
  const settings = pull.meta.settings
    ? { ...DEFAULT_SETTINGS, ...pull.meta.settings, sheetSyncUrl: url }
    : { ...DEFAULT_SETTINGS, sheetSyncUrl: url };
  const data = {
    business: [pull.meta.business],
    products: pull.products,
    categories: pull.meta.categories ?? [],
    customers: pull.customers,
    orders: pull.orders,
    order_items: pull.orderItems,
    payments: pull.meta.payments ?? [],
    inventory: [],
    settings: [settings],
    held_carts: [],
    sync_queue: [],
    // POS slices only — restore replaces these and leaves toolkit stores
    // (expenses, suppliers, appointments, …) untouched.
  } satisfies Partial<Record<StoreName, unknown[]>>;
  return {
    app: BACKUP_APP_MARKER,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

// ---------------------------------------------------------------------------
// The script users paste into their Google Sheet (Extensions → Apps Script).
// Kept free of backticks/template literals so it embeds cleanly here.
// ---------------------------------------------------------------------------
export const APPS_SCRIPT_TEMPLATE = `// Setu Browser Based POS — Google Sheet sync script (v1)
// 1. In your Google Sheet: Extensions -> Apps Script, replace everything with this file.
// 2. Click Deploy -> New deployment -> type: Web app.
//    - Execute as: Me
//    - Who has access: Anyone
// 3. Copy the Web app URL and paste it into the POS (Settings -> Google Sheet sync).
// Treat that URL like the share link of this sheet.

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "";
  if (action === "pull") return respond_(pullAll_());
  return respond_({ ok: true, app: "setu-pos-sheet-sync", version: 1 });
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
  var names = ["Meta", "Products", "Customers", "Orders", "Order Items"];
  var ss = SpreadsheetApp.getActive();
  var tabs = {};
  for (var i = 0; i < names.length; i++) {
    var sheet = ss.getSheetByName(names[i]);
    tabs[names[i]] = sheet ? sheet.getDataRange().getValues() : [];
  }
  return { ok: true, app: "setu-pos-sheet-sync", tabs: tabs };
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
`;
