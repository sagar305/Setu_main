// Amount parsing for bank statements — Indian formatting first.

/**
 * Parse an amount cell as printed on a statement. Handles Indian grouping
 * (1,23,456.78), trailing/leading Dr/Cr markers, bracketed negatives, spaces,
 * currency symbols and the unicode minus. Returns null when the cell is not an
 * amount at all, so callers can tell "no value" from "zero".
 */
export function parseAmount(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (raw === null || raw === undefined) return null;

  let text = String(raw).trim();
  if (text === "" || text === "-" || text === "—" || text === "–") return null;

  let negative = false;

  // (1,234.00) — accounting negative.
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }

  // Dr/Cr suffix or prefix. Cr is positive, Dr negative in a signed column.
  const drCr = text.match(/(^|\s)(dr|cr)\.?(\s|$)/i);
  if (drCr) {
    if (drCr[2].toLowerCase() === "dr") negative = true;
    text = text.replace(/(^|\s)(dr|cr)\.?(\s|$)/i, " ");
  }

  text = text
    .replace(/[₹$€£]/g, "")
    .replace(/−/g, "-") // unicode minus
    .replace(/[\s ]/g, "")
    .replace(/,/g, "");

  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }

  if (!/^\d*\.?\d+$/.test(text) && !/^\d+\.?\d*$/.test(text)) return null;

  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/** True when a cell looks like a money amount (used for column detection). */
export function looksLikeAmount(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === "") return false;
  if (!/\d/.test(trimmed)) return false;
  // Reject long digit runs with no separators — those are reference numbers.
  if (/^\d{9,}$/.test(trimmed.replace(/[\s,]/g, ""))) return false;
  return parseAmount(trimmed) !== null;
}

/** Round to paise so float drift never shows up in a CA-facing total. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Statement amounts agree if they are within half a paisa. */
export function amountsEqual(a: number, b: number, tolerance = 0.005): boolean {
  return Math.abs(a - b) <= tolerance;
}

/** Indian digit grouping without a currency symbol: 1234567.5 → "12,34,567.50" */
export function groupIndian(value: number): string {
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(2);
  const [whole, fraction] = fixed.split(".");
  let grouped: string;
  if (whole.length <= 3) {
    grouped = whole;
  } else {
    const last3 = whole.slice(-3);
    const rest = whole.slice(0, -3);
    grouped = `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`;
  }
  return `${negative ? "-" : ""}${grouped}.${fraction}`;
}

/** Amount in words, Indian numbering (lakh / crore). Whole rupees + paise. */
export function amountInWords(value: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const twoDigits = (n: number): string =>
    n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`;

  const threeDigits = (n: number): string => {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    return [
      hundred ? `${ones[hundred]} Hundred` : "",
      rest ? twoDigits(rest) : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  const negative = value < 0;
  const absolute = Math.abs(round2(value));
  let rupees = Math.floor(absolute);
  const paise = Math.round((absolute - rupees) * 100);

  if (rupees === 0 && paise === 0) return "Zero";

  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000);
  rupees %= 10000000;
  const lakh = Math.floor(rupees / 100000);
  rupees %= 100000;
  const thousand = Math.floor(rupees / 1000);
  rupees %= 1000;

  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rupees) parts.push(threeDigits(rupees));

  let words = parts.join(" ").trim();
  if (paise) words = words ? `${words} and ${twoDigits(paise)} Paise` : `${twoDigits(paise)} Paise`;
  return `${negative ? "Minus " : ""}${words}`.trim();
}
