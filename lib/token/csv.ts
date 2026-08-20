// CSV exports for the queue.
//
// The reports screen answers the owner's questions on screen; this is for the
// ones it does not anticipate. Everything a spreadsheet could want is one
// row per token, plus the summaries as they are drawn.

export { toCsv, downloadCsv } from "@/lib/pos/csv";

import { toCsv } from "@/lib/pos/csv";
import {
  formatClock,
  formatHourRange,
  type CounterPerformance,
  type DayTotals,
  type HourLoad,
  type ServiceDemand,
  type TokenRow,
} from "./reports";
import { TOKEN_STATUS_LABELS } from "./types";

function minutesCell(value: number | null): string {
  return value === null ? "" : String(Math.round(value));
}

/** One row per token — the export everything else can be rebuilt from. */
export function tokensCsv(rows: TokenRow[]): string {
  const header = [
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
    "Started",
    "Closed",
    "Waited (min)",
    "Service time (min)",
    "Recalls",
    "Self-issued",
    "Note",
  ];
  const body = rows.map((row) => [
    row.token.date,
    row.label,
    row.serviceName,
    TOKEN_STATUS_LABELS[row.token.status],
    row.token.priority ? "Yes" : "",
    row.counterName,
    row.token.customerName,
    row.token.phone,
    formatClock(row.token.issuedAt),
    formatClock(row.token.calledAt),
    formatClock(row.token.servingStartedAt),
    formatClock(row.token.closedAt),
    minutesCell(row.waited),
    minutesCell(row.serviceTime),
    row.token.recallCount || "",
    row.token.selfIssued ? "Yes" : "",
    row.token.note,
  ]);
  return toCsv(header, body);
}

export function dailyTotalsCsv(days: DayTotals[]): string {
  const header = ["Date", "Issued", "Served", "Skipped", "Cancelled", "Still open"];
  const body = days.map((day) => [
    day.date,
    day.issued,
    day.served,
    day.skipped,
    day.cancelled,
    day.open,
  ]);
  return toCsv(header, body);
}

export function hourLoadCsv(hours: HourLoad[]): string {
  const header = ["Hour", "Tokens issued"];
  const body = hours.map((row) => [formatHourRange(row.hour), row.issued]);
  return toCsv(header, body);
}

export function counterPerformanceCsv(rows: CounterPerformance[]): string {
  const header = ["Counter", "Staff", "Served", "Avg wait (min)", "Avg service (min)"];
  const body = rows.map((row) => [
    row.name,
    row.staffName,
    row.served,
    minutesCell(row.averageWait),
    minutesCell(row.averageService),
  ]);
  return toCsv(header, body);
}

export function serviceDemandCsv(rows: ServiceDemand[]): string {
  const header = ["Service", "Issued", "Served", "Share of tokens", "Avg service (min)"];
  const body = rows.map((row) => [
    row.name,
    row.issued,
    row.served,
    `${Math.round(row.share * 100)}%`,
    minutesCell(row.averageService),
  ]);
  return toCsv(header, body);
}
