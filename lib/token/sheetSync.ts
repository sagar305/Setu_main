// Google Sheet sync for the queue.
//
// Same protocol as the POS, tuition and clinic syncs: the owner pastes the
// Apps Script into their own Google Sheet, deploys it as a web app, and this
// pushes whole-tab snapshots to that URL. Off until a URL is pasted; nothing
// leaves the device otherwise.
//
// What it is for here is narrower than in the other apps. A queue is not a
// ledger — nobody reconciles tokens. It is for the owner who wants yesterday's
// numbers somewhere other than one browser on one counter PC, and for the
// small chain where the head office wants to see four branches' load in one
// spreadsheet. So the push is one-way and there is no pull: pulling would let
// a spreadsheet edit rewrite a live queue, which is a way to lose a person.

import type { Business } from "@/lib/pos/types";
import {
  formatClock,
  performanceByCounter,
  loadByHour,
  formatHourRange,
  tokenRows,
  totalsByDay,
  demandByService,
} from "./reports";
import { TOKEN_STATUS_LABELS, type Counter, type TokenSettings, type Service, type Token } from "./types";

type TabPayload = { tab: string; headers: string[]; rows: (string | number | boolean)[][] };

export const SHEET_TABS = {
  meta: "Meta",
  tokens: "Tokens",
  daily: "Daily Totals",
  hourly: "Hourly Load",
  counters: "Counters",
  services: "Services",
} as const;

export const SHEET_TAB_NAMES = Object.values(SHEET_TABS);

export type TokenSnapshot = {
  business: Business | null;
  settings: TokenSettings;
  services: Service[];
  counters: Counter[];
  tokens: Token[];
};

export type SyncSlice = keyof typeof SHEET_TABS;

function metaTab(snapshot: TokenSnapshot): TabPayload {
  const { business, settings } = snapshot;
  return {
    tab: SHEET_TABS.meta,
    headers: ["Field", "Value"],
    rows: [
      ["Business", business?.name ?? ""],
      ["Phone", business?.phone ?? ""],
      ["Display title", settings.displayTitle],
      ["Daily reset hour", settings.dailyResetHour],
      ["Services", snapshot.services.length],
      ["Counters", snapshot.counters.length],
      ["Exported at", new Date().toISOString()],
    ],
  };
}

function tokensTab(snapshot: TokenSnapshot): TabPayload {
  const rows = tokenRows(snapshot.tokens, snapshot.services, snapshot.counters);
  return {
    tab: SHEET_TABS.tokens,
    headers: [
      "Date",
      "Token",
      "Service",
      "Status",
      "Priority",
      "Counter",
      "Customer",
      "Phone",
      "Issued",
      "Called",
      "Closed",
      "Waited (min)",
      "Service time (min)",
    ],
    rows: rows.map((row) => [
      row.token.date,
      row.label,
      row.serviceName,
      TOKEN_STATUS_LABELS[row.token.status],
      row.token.priority,
      row.counterName,
      row.token.customerName,
      row.token.phone,
      formatClock(row.token.issuedAt),
      formatClock(row.token.calledAt),
      formatClock(row.token.closedAt),
      row.waited === null ? "" : Math.round(row.waited),
      row.serviceTime === null ? "" : Math.round(row.serviceTime),
    ]),
  };
}

function dailyTab(snapshot: TokenSnapshot): TabPayload {
  return {
    tab: SHEET_TABS.daily,
    headers: ["Date", "Issued", "Served", "Skipped", "Cancelled"],
    rows: totalsByDay(snapshot.tokens).map((day) => [
      day.date,
      day.issued,
      day.served,
      day.skipped,
      day.cancelled,
    ]),
  };
}

function hourlyTab(snapshot: TokenSnapshot): TabPayload {
  return {
    tab: SHEET_TABS.hourly,
    headers: ["Hour", "Tokens issued"],
    rows: loadByHour(snapshot.tokens).map((row) => [formatHourRange(row.hour), row.issued]),
  };
}

function countersTab(snapshot: TokenSnapshot): TabPayload {
  return {
    tab: SHEET_TABS.counters,
    headers: ["Counter", "Staff", "Served", "Avg wait (min)", "Avg service (min)"],
    rows: performanceByCounter(snapshot.tokens, snapshot.counters).map((row) => [
      row.name,
      row.staffName,
      row.served,
      row.averageWait === null ? "" : Math.round(row.averageWait),
      row.averageService === null ? "" : Math.round(row.averageService),
    ]),
  };
}

function servicesTab(snapshot: TokenSnapshot): TabPayload {
  return {
    tab: SHEET_TABS.services,
    headers: ["Service", "Prefix", "Est. minutes", "Active", "Issued", "Served"],
    rows: snapshot.services.map((service) => {
      const demand = demandByService(snapshot.tokens, [service])[0];
      return [
        service.name,
        service.prefix,
        service.avgServiceMinutes,
        service.active,
        demand?.issued ?? 0,
        demand?.served ?? 0,
      ];
    }),
  };
}

export function buildTabPayloads(slices: SyncSlice[], snapshot: TokenSnapshot): TabPayload[] {
  const builders: Record<SyncSlice, (s: TokenSnapshot) => TabPayload> = {
    meta: metaTab,
    tokens: tokensTab,
    daily: dailyTab,
    hourly: hourlyTab,
    counters: countersTab,
    services: servicesTab,
  };
  return slices.map((slice) => builders[slice](snapshot));
}

export const ALL_SYNC_SLICES: SyncSlice[] = [
  "meta",
  "tokens",
  "daily",
  "hourly",
  "counters",
  "services",
];

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
    const result = (await postToScript(url, { action: "test", app: "setu-token" })) as {
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
  const result = (await postToScript(url, { action: "push", app: "setu-token", tabs })) as {
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
