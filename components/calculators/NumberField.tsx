"use client";

import { usePreferredCurrencySymbol } from "@/lib/hooks/usePreferredCurrency";

export function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
}) {
  // A "₹" prefix means "the user's currency", so follow the Business Profile
  // currency; any other prefix (%, hrs…) is shown as-is.
  const currencySym = usePreferredCurrencySymbol();
  const shownPrefix = prefix === "₹" ? currencySym : prefix;
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <div className="mt-2 flex items-center rounded-xl border border-muted-line/40 bg-white px-4 transition focus-within:border-indigo">
        {shownPrefix && <span className="mr-2 text-sm text-muted-warm">{shownPrefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent py-3 text-base text-ink outline-none placeholder:text-muted-line"
        />
        {suffix && <span className="ml-2 text-sm text-muted-warm">{suffix}</span>}
      </div>
    </label>
  );
}
