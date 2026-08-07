"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { SegmentedControl } from "@/components/calculators/SegmentedControl";
import { formatCurrency, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { COUNTRY_VAT_RATES } from "@/lib/constants/taxRates";

type Mode = "add" | "remove";

export function VatCalculatorTool() {
  usePreferredCurrency(); // re-render when the business currency changes
  const [mode, setMode] = useState<Mode>("add");
  const [amount, setAmount] = useState("1000");
  const [rate, setRate] = useState("20");
  const [country, setCountry] = useState("United Kingdom");
  const [search, setSearch] = useState("");
  const [customRate, setCustomRate] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRY_VAT_RATES;
    return COUNTRY_VAT_RATES.filter((c) => c.country.toLowerCase().includes(q));
  }, [search]);

  const selected = COUNTRY_VAT_RATES.find((c) => c.country === country);

  const pick = (name: string) => {
    const c = COUNTRY_VAT_RATES.find((x) => x.country === name);
    if (!c) return;
    setCountry(name);
    setCustomRate(false);
    setRate(String(c.rate));
  };

  const result = useMemo(() => {
    const value = parseNumber(amount);
    const vatRate = parseNumber(rate) / 100;
    if (mode === "add") {
      const vat = value * vatRate;
      return { net: value, vat, gross: value + vat };
    }
    const net = vatRate > -1 ? value / (1 + vatRate) : 0;
    return { net, vat: value - net, gross: value };
  }, [mode, amount, rate]);

  return (
    <div>
      <SegmentedControl
        options={[
          { label: "Add VAT", value: "add" },
          { label: "Remove VAT", value: "remove" },
        ]}
        value={mode}
        onChange={setMode}
      />

      {/* Country rate table */}
      <div className="mt-5 rounded-xl border border-muted-line/40">
        <div className="border-b border-muted-line/30 p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search country… (65+ countries)"
            className="w-full rounded-lg border border-muted-line/40 px-3 py-2 text-sm text-ink outline-none focus:border-indigo"
          />
        </div>
        <div className="max-h-56 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="hidden px-3 py-2 sm:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.country}
                  onClick={() => pick(c.country)}
                  className={`cursor-pointer border-t border-muted-line/20 ${
                    country === c.country && !customRate ? "bg-indigo/10" : "hover:bg-cream-paper/60"
                  }`}
                >
                  <td className="px-3 py-1.5 font-medium text-ink">{c.country}</td>
                  <td className="px-3 py-1.5">
                    <span className="rounded-full bg-cream px-2 py-0.5 text-xs font-semibold text-muted">
                      {c.type}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right font-bold">{c.rate}%</td>
                  <td className="hidden px-3 py-1.5 text-xs text-muted sm:table-cell">{c.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={customRate}
          onChange={(e) => setCustomRate(e.target.checked)}
          className="h-4 w-4 accent-indigo"
        />
        Use a custom rate
      </label>

      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <NumberField
          label={mode === "add" ? "Amount before VAT" : "Amount including VAT"}
          value={amount}
          onChange={setAmount}
          prefix="₹"
        />
        {customRate ? (
          <NumberField label="Custom rate" value={rate} onChange={setRate} suffix="%" />
        ) : (
          <div className="rounded-xl bg-cream-paper/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Selected</p>
            <p className="mt-1 text-lg font-bold text-ink">
              {selected ? `${selected.country} — ${rate}% ${selected.type}` : `${rate}%`}
            </p>
            {selected?.note ? <p className="text-xs text-muted">{selected.note}</p> : null}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultStat label="Net amount" value={formatCurrency(result.net)} />
        <ResultStat label="VAT amount" value={formatCurrency(result.vat)} />
        <ResultStat label="Gross amount" value={formatCurrency(result.gross)} emphasis />
      </div>

      <p className="mt-4 text-xs text-muted">
        Standard rates for reference — many countries also apply reduced or zero rates to specific
        goods. Verify the rate for your product category before invoicing.
      </p>
    </div>
  );
}
