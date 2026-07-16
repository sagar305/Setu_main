export function parseNumber(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "₹0.00";
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNumber(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-IN", { maximumFractionDigits: decimals });
}
