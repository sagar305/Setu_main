"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { SegmentedControl } from "@/components/calculators/SegmentedControl";
import { formatCurrency, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { COUNTRY_VAT_RATES, type CountryVatRate } from "@/lib/constants/taxRates";

type Mode = "add" | "remove";

export function VatCalculatorTool() {
  usePreferredCurrency(); // re-render when the business currency changes
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<Mode>("add");
  const [amount, setAmount] = useState("1000");
  const [rate, setRate] = useState("20");
  // The ISO code, not the name: the name on screen is whatever the reader's
  // language calls the country, so it cannot be what identifies the row.
  const [code, setCode] = useState("GB");
  const [search, setSearch] = useState("");
  const [customRate, setCustomRate] = useState(false);

  // Country names come from the browser's own locale data, so the table reads
  // in the page's language without 65 names to translate by hand. Falls back to
  // the English name where Intl has nothing.
  const names = useMemo(() => {
    let display: Intl.DisplayNames | null = null;
    try {
      display = new Intl.DisplayNames([lang], { type: "region" });
    } catch {
      display = null;
    }
    const map = new Map<string, string>();
    for (const c of COUNTRY_VAT_RATES) {
      let name = c.country;
      try {
        name = display?.of(c.code) || c.country;
      } catch {
        name = c.country;
      }
      map.set(c.code, name);
    }
    return map;
  }, [lang]);

  const countryName = (c: CountryVatRate) => names.get(c.code) ?? c.country;

  // Searching matches the translated name and the English one, so a reader who
  // knows the country by either spelling finds it.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRY_VAT_RATES;
    return COUNTRY_VAT_RATES.filter(
      (c) =>
        (names.get(c.code) ?? "").toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.code.toLowerCase() === q
    );
  }, [search, names]);

  const selected = COUNTRY_VAT_RATES.find((c) => c.code === code);

  const pick = (c: CountryVatRate) => {
    setCode(c.code);
    setCustomRate(false);
    setRate(String(c.rate));
  };

  // Reduced rates are figures and stay as written; the note is prose.
  const noteFor = (c: CountryVatRate) =>
    [
      c.reduced ? fill(t("vatReducedRates"), { rates: c.reduced }) : "",
      c.note ? t(c.note) : "",
    ]
      .filter(Boolean)
      .join(" · ");

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
          { label: t("vatAdd"), value: "add" },
          { label: t("vatRemove"), value: "remove" },
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
            placeholder={fill(t("vatSearchCountry"), { count: COUNTRY_VAT_RATES.length })}
            className="w-full rounded-lg border border-muted-line/40 px-3 py-2 text-sm text-ink outline-none focus:border-indigo"
          />
        </div>
        <div className="max-h-56 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-3 py-2">{t("vatCountry")}</th>
                <th className="px-3 py-2">{t("typeLabel")}</th>
                <th className="px-3 py-2 text-right">{t("rate")}</th>
                <th className="hidden px-3 py-2 sm:table-cell">{t("notes")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.code}
                  onClick={() => pick(c)}
                  className={`cursor-pointer border-t border-muted-line/20 ${
                    code === c.code && !customRate ? "bg-indigo/10" : "hover:bg-cream-paper/60"
                  }`}
                >
                  <td className="px-3 py-1.5 font-medium text-ink">{countryName(c)}</td>
                  <td className="px-3 py-1.5">
                    <span className="rounded-full bg-cream px-2 py-0.5 text-xs font-semibold text-muted">
                      {c.type}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right font-bold">{c.rate}%</td>
                  <td className="hidden px-3 py-1.5 text-xs text-muted sm:table-cell">
                    {noteFor(c)}
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
        {t("vatCustomRate")}
      </label>

      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <NumberField
          label={t(mode === "add" ? "vatAmountBefore" : "vatAmountIncluding")}
          value={amount}
          onChange={setAmount}
          prefix="₹"
        />
        {customRate ? (
          <NumberField label={t("vatCustomRateLabel")} value={rate} onChange={setRate} suffix="%" />
        ) : (
          <div className="rounded-xl bg-cream-paper/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("vatSelected")}
            </p>
            <p className="mt-1 text-lg font-bold text-ink">
              {selected ? `${countryName(selected)} — ${rate}% ${selected.type}` : `${rate}%`}
            </p>
            {selected && noteFor(selected) ? (
              <p className="text-xs text-muted">{noteFor(selected)}</p>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultStat label={t("vatNetAmount")} value={formatCurrency(result.net)} />
        <ResultStat label={t("vatVatAmount")} value={formatCurrency(result.vat)} />
        <ResultStat label={t("vatGrossAmount")} value={formatCurrency(result.gross)} emphasis />
      </div>

      <p className="mt-4 text-xs text-muted">{t("vatFootnote")}</p>
    </div>
  );
}
