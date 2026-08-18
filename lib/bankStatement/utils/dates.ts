// Date parsing for bank statements.
// ---------------------------------------------------------------------------
// Priority order (decision 15): a bank adapter's known format, then a format
// detected from the statement's own dates, then DD/MM/YYYY. Where the sample
// is genuinely ambiguous we say so rather than guessing silently.

import type { DateFormat } from "@/lib/bankStatement/types";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

type DateParts = { a: number; b: number; year: number };

/** Split a numeric date into its two ambiguous components plus the year. */
function numericParts(raw: string): DateParts | null {
  const match = raw
    .trim()
    .match(/^(\d{1,4})[/\-. ](\d{1,2})[/\-. ](\d{1,4})$/);
  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = Number(match[3]);

  // yyyy-mm-dd
  if (match[1].length === 4) {
    return { a: third, b: second, year: first };
  }

  let year = third;
  if (match[3].length <= 2) year = third + (third < 70 ? 2000 : 1900);
  return { a: first, b: second, year };
}

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1900 || year > 2200) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects impossible dates like 31 February (§10 date validation).
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parse "12 Mar 2026", "12-MAR-26", "Mar 12, 2026". */
function parseTextual(raw: string): string | null {
  const text = raw.trim().replace(/,/g, " ").replace(/\s+/g, " ");

  let match = text.match(/^(\d{1,2})[\s\-/]([A-Za-z]{3,9})[\s\-/](\d{2,4})$/);
  if (match) {
    const month = MONTHS[match[2].slice(0, 4).toLowerCase()] ?? MONTHS[match[2].slice(0, 3).toLowerCase()];
    if (!month) return null;
    const yearRaw = Number(match[3]);
    const year = match[3].length <= 2 ? yearRaw + (yearRaw < 70 ? 2000 : 1900) : yearRaw;
    return iso(year, month, Number(match[1]));
  }

  match = text.match(/^([A-Za-z]{3,9})[\s\-/](\d{1,2})[\s\-/](\d{2,4})$/);
  if (match) {
    const month = MONTHS[match[1].slice(0, 4).toLowerCase()] ?? MONTHS[match[1].slice(0, 3).toLowerCase()];
    if (!month) return null;
    const yearRaw = Number(match[3]);
    const year = match[3].length <= 2 ? yearRaw + (yearRaw < 70 ? 2000 : 1900) : yearRaw;
    return iso(year, month, Number(match[2]));
  }

  return null;
}

/**
 * Parse a statement date cell into ISO yyyy-mm-dd, or null when it is not a
 * date. `format` decides how an ambiguous numeric date is read.
 */
export function parseDate(raw: string | null | undefined, format: DateFormat = "DMY"): string | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (text === "") return null;

  const textual = parseTextual(text);
  if (textual) return textual;

  const parts = numericParts(text);
  if (!parts) return null;

  if (format === "YMD") return iso(parts.year, parts.b, parts.a);
  if (format === "MDY") return iso(parts.year, parts.a, parts.b);
  return iso(parts.year, parts.b, parts.a);
}

/** True when a cell parses as a date under any supported format. */
export function looksLikeDate(raw: string): boolean {
  return (
    parseDate(raw, "DMY") !== null ||
    parseDate(raw, "MDY") !== null ||
    parseDate(raw, "YMD") !== null
  );
}

export type DateFormatDetection = {
  format: DateFormat;
  /** True when both DMY and MDY remain possible across the whole sample. */
  ambiguous: boolean;
};

/**
 * Work out how a statement writes its dates by testing the whole column.
 * A value with a first component > 12 proves DMY; > 12 in the second proves
 * MDY. If nothing in the sample proves either, the column is ambiguous and the
 * CA is asked (decision 15).
 */
export function detectDateFormat(samples: string[]): DateFormatDetection {
  let dmyOnly = 0;
  let mdyOnly = 0;
  let numeric = 0;
  let isoLike = 0;

  for (const sample of samples) {
    const text = String(sample ?? "").trim();
    if (text === "") continue;
    if (parseTextual(text)) continue; // unambiguous by construction

    const parts = numericParts(text);
    if (!parts) continue;
    numeric += 1;

    if (/^\d{4}/.test(text)) {
      isoLike += 1;
      continue;
    }
    if (parts.a > 12 && parts.b <= 12) dmyOnly += 1;
    else if (parts.b > 12 && parts.a <= 12) mdyOnly += 1;
  }

  if (isoLike > 0 && isoLike >= numeric) return { format: "YMD", ambiguous: false };
  if (dmyOnly > 0 && mdyOnly === 0) return { format: "DMY", ambiguous: false };
  if (mdyOnly > 0 && dmyOnly === 0) return { format: "MDY", ambiguous: false };
  if (dmyOnly > 0 && mdyOnly > 0) {
    // Both proven — the column is inconsistent. Prefer DMY and warn.
    return { format: "DMY", ambiguous: true };
  }
  // Nothing proved it either way, and there were numeric dates to judge.
  return { format: "DMY", ambiguous: numeric > 0 };
}

/** yyyy-mm bucket for monthly analysis. */
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** "Mar 2026" for display. */
export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** Display an ISO date the way an Indian statement would print it. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/** Whole days between two ISO dates (b − a). */
export function daysBetween(a: string, b: string): number {
  const first = Date.parse(`${a}T00:00:00Z`);
  const second = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(first) || Number.isNaN(second)) return Number.POSITIVE_INFINITY;
  return Math.round((second - first) / 86400000);
}

/** 0 = Sunday. Used by the weekend-cash anomaly check. */
export function dayOfWeek(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}
