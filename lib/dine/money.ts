// Money for Free Dine.
//
// Every amount in this product is an integer number of the currency's minor
// unit (paise for INR). Floats are never used for currency: a restaurant bill
// is summed from a dozen lines with per-line tax, and 0.1 + 0.2 !== 0.3 shows
// up as a one-paisa mismatch on a printed GST bill, which is a compliance
// problem rather than a rounding curiosity (NFR-7).
//
// Convert at the edges only — parse user input with `parseAmount`, render with
// `formatPaise`. Nothing in between should see a rupee float.

/** Convert a user-facing major-unit value (₹120.50) to minor units (12050). */
export function toPaise(major: number): number {
  if (!Number.isFinite(major)) return 0;
  // Scale first, then round: Math.round(120.505 * 100) is exact enough here
  // because the input has at most 2 decimals from a currency input field.
  return Math.round(major * 100);
}

/** Convert minor units back to a major-unit number, for display or export. */
export function toMajor(paise: number): number {
  return Math.round(paise) / 100;
}

/**
 * Parse a typed amount ("1,250.50", "₹90", "") into paise. Returns 0 for
 * anything unparseable so a half-typed field never poisons a running total.
 */
export function parseAmount(input: string): number {
  const cleaned = String(input).replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return 0;
  const value = Number(cleaned);
  return Number.isFinite(value) ? toPaise(value) : 0;
}

/**
 * Multiply paise by a percentage, rounding half away from zero.
 *
 * Used for every tax and discount calculation, so the rounding rule lives in
 * exactly one place — this is what makes a hand-calculated bill match to the
 * paisa (AC-5).
 */
export function percentOf(paise: number, rate: number): number {
  if (!Number.isFinite(rate) || rate === 0) return 0;
  return roundHalfUp((paise * rate) / 100);
}

/**
 * Extract the tax already contained in a tax-inclusive amount:
 * base * rate / (100 + rate).
 */
export function taxWithin(paise: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return roundHalfUp((paise * rate) / (100 + rate));
}

function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * Split `total` across `weights` so the parts sum to exactly `total`.
 *
 * Proportional division loses or gains paise to rounding; the largest-remainder
 * method hands the leftover to the lines with the biggest fractional part. This
 * is what keeps a discount apportioned across ten lines from being ₹0.02 off,
 * and what makes a split bill's parts add back up to the original (FR-6.5).
 */
export function apportion(total: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((sum, w) => sum + Math.max(w, 0), 0);
  if (totalWeight <= 0 || weights.length === 0) {
    return weights.map(() => 0);
  }

  const exact = weights.map((w) => (Math.max(w, 0) * total) / totalWeight);
  const floored = exact.map((value) => Math.floor(value));
  let remainder = total - floored.reduce((sum, value) => sum + value, 0);

  // Hand out the leftover units to the largest fractional parts first.
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  const result = [...floored];
  for (const { index } of order) {
    if (remainder <= 0) break;
    result[index] += 1;
    remainder -= 1;
  }
  return result;
}

/** Split a tax amount into CGST/SGST halves that sum back exactly. */
export function halveTax(paise: number): { cgst: number; sgst: number } {
  const cgst = Math.floor(paise / 2);
  return { cgst, sgst: paise - cgst };
}

const SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
  SGD: "S$",
};

export function currencySymbol(code: string): string {
  if (SYMBOLS[code]) return SYMBOLS[code];
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(1);
    return parts.find((part) => part.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}

/** Render paise as a currency string, e.g. 12050 → "₹1,250.50". */
export function formatPaise(paise: number, currency: string): string {
  const major = toMajor(paise);
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currencySymbol(currency)}${major.toFixed(2)}`;
  }
}

/** Render paise without the currency symbol, for CSV and input fields. */
export function formatPlain(paise: number): string {
  return toMajor(paise).toFixed(2);
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones ? `${TENS[tens]} ${ONES[ones]}` : TENS[tens];
}

function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds && rest) return `${ONES[hundreds]} Hundred ${twoDigits(rest)}`;
  if (hundreds) return `${ONES[hundreds]} Hundred`;
  return twoDigits(rest);
}

/**
 * Amount in words using the Indian numbering system — crore, lakh, thousand
 * (FR-7.4). Required on GST invoices and expected on a restaurant bill.
 */
export function amountInWords(paise: number, currency = "INR"): string {
  const negative = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100);
  const fraction = abs % 100;

  const unit = currency === "INR" ? "Rupees" : currency;
  const subUnit = currency === "INR" ? "Paise" : "Cents";

  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;

  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));

  const whole = parts.length ? parts.join(" ") : "Zero";
  const head = `${negative ? "Minus " : ""}${unit} ${whole}`;
  const tail = fraction ? ` and ${twoDigits(fraction)} ${subUnit}` : "";
  return `${head}${tail} Only`;
}
