"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { SegmentedControl } from "@/components/calculators/SegmentedControl";
import { formatCurrency, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";
import { US_STATE_TAX_RATES } from "@/lib/constants/taxRates";

type Mode = "add" | "extract";
type RateMode = "state" | "combined";

export function SalesTaxCalculatorTool() {
  usePreferredCurrency(); // re-render when the business currency changes
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("add");
  const [rateMode, setRateMode] = useState<RateMode>("combined");
  const [amount, setAmount] = useState("100");
  const [stateCode, setStateCode] = useState("CA");
  const [search, setSearch] = useState("");
  const [customRate, setCustomRate] = useState(false);
  const [custom, setCustom] = useState("8.5");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return US_STATE_TAX_RATES;
    return US_STATE_TAX_RATES.filter(
      (s) => s.state.toLowerCase().includes(q) || s.code.toLowerCase() === q
    );
  }, [search]);

  const selected = US_STATE_TAX_RATES.find((s) => s.code === stateCode);

  const rate = customRate
    ? parseNumber(custom)
    : selected
      ? rateMode === "state"
        ? selected.stateRate
        : selected.stateRate + selected.avgLocalRate
      : 0;

  const result = useMemo(() => {
    const value = parseNumber(amount);
    const r = rate / 100;
    if (mode === "add") {
      const tax = value * r;
      return { preTax: value, tax, total: value + tax };
    }
    const preTax = r > -1 ? value / (1 + r) : 0;
    return { preTax, tax: value - preTax, total: value };
  }, [amount, rate, mode]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          options={[
            { label: t("sxAddTax"), value: "add" },
            { label: t("sxExtract"), value: "extract" },
          ]}
          value={mode}
          onChange={setMode}
        />
        <SegmentedControl
          options={[
            { label: t("sxStateOnly"), value: "state" },
            { label: t("sxCombined"), value: "combined" },
          ]}
          value={rateMode}
          onChange={setRateMode}
        />
      </div>

      {/* State rate table */}
      <div className="mt-5 rounded-xl border border-muted-line/40">
        <div className="border-b border-muted-line/30 p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("sxSearchState")}
            className="w-full rounded-lg border border-muted-line/40 px-3 py-2 text-sm text-ink outline-none focus:border-indigo"
          />
        </div>
        <div className="max-h-56 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-3 py-2">{t("sxState")}</th>
                <th className="px-3 py-2 text-right">{t("sxStatePct")}</th>
                <th className="px-3 py-2 text-right">{t("sxAvgLocalPct")}</th>
                <th className="px-3 py-2 text-right">{t("sxCombined")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.code}
                  onClick={() => {
                    setStateCode(s.code);
                    setCustomRate(false);
                  }}
                  className={`cursor-pointer border-t border-muted-line/20 ${
                    stateCode === s.code && !customRate ? "bg-indigo/10" : "hover:bg-cream-paper/60"
                  }`}
                >
                  <td className="px-3 py-1.5 font-medium text-ink">
                    {s.state} <span className="text-xs text-muted">{s.code}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {s.stateRate > 0 ? `${s.stateRate}%` : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right text-muted">
                    {s.avgLocalRate > 0 ? `+${s.avgLocalRate}%` : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right font-bold">
                    {(s.stateRate + s.avgLocalRate).toFixed(2)}%
                  </td>
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
        {t("sxCustomRate")}
      </label>

      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <NumberField
          label={t(mode === "add" ? "sxPreTaxPrice" : "sxTotalPaid")}
          value={amount}
          onChange={setAmount}
          prefix="₹"
        />
        {customRate ? (
          <NumberField
            label={t("sxCustomCombined")}
            value={custom}
            onChange={setCustom}
            suffix="%"
          />
        ) : (
          <div className="rounded-xl bg-cream-paper/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("vatSelected")}
            </p>
            <p className="mt-1 text-lg font-bold text-ink">
              {selected ? `${selected.state} — ${rate.toFixed(2)}%` : "—"}
            </p>
            <p className="text-xs text-muted">
              {t(rateMode === "combined" ? "sxStatePlusLocal" : "sxStateRateOnly")}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultStat label={t("sxPreTaxPrice")} value={formatCurrency(result.preTax)} />
        <ResultStat label={t("sxSalesTax")} value={formatCurrency(result.tax)} />
        <ResultStat label={t("sxTotalPrice")} value={formatCurrency(result.total)} emphasis />
      </div>

      <p className="mt-4 text-xs text-muted">{t("sxFootnote")}</p>
    </div>
  );
}
