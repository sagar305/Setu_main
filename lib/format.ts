import { formatMoneyIntl, getPreferredCurrency } from "@/lib/toolkit/preferences";

export function parseNumber(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Format money for calculators. Uses the user's preferred currency (shared
 * preference, default INR) unless a specific currency is passed. On the
 * server this always renders INR; a user with a different saved preference
 * sees their currency after hydration.
 */
export function formatCurrency(value: number, currency?: string): string {
  return formatMoneyIntl(value, currency ?? getPreferredCurrency());
}

export function formatNumber(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(getPreferredCurrency() === "INR" ? "en-IN" : "en", {
    maximumFractionDigits: decimals,
  });
}
