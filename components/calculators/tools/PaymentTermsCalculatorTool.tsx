"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, formatNumber, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { intlLocaleFor } from "@/lib/i18n/pages";

const TERM_PRESETS = ["7", "15", "30", "45", "60", "90"];

export function PaymentTermsCalculatorTool() {
  const { t, lang } = useI18n();
  usePreferredCurrency(); // re-render when the business currency changes
  const [amount, setAmount] = useState("100000");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [netDays, setNetDays] = useState("30");
  const [discountPct, setDiscountPct] = useState("2");
  const [discountDays, setDiscountDays] = useState("10");

  const result = useMemo(() => {
    const value = parseNumber(amount);
    const net = Math.max(Math.round(parseNumber(netDays)), 0);
    const dPct = parseNumber(discountPct);
    const dDays = Math.max(Math.round(parseNumber(discountDays)), 0);

    const base = new Date(invoiceDate + "T00:00:00");
    const valid = !Number.isNaN(base.getTime());
    const addDays = (days: number) => {
      const d = new Date(base);
      d.setDate(d.getDate() + days);
      return d.toLocaleDateString(intlLocaleFor(lang), {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    };

    const discountAmount = value * (dPct / 100);
    // Cost of skipping the early-pay discount, annualized over the extra days
    // of credit it buys (the standard trade-credit formula).
    const extraDays = net - dDays;
    const annualCost =
      dPct > 0 && dPct < 100 && extraDays > 0
        ? (dPct / (100 - dPct)) * (365 / extraDays) * 100
        : 0;

    return {
      dueDate: valid ? addDays(net) : "—",
      discountDate: valid && dPct > 0 ? addDays(dDays) : "—",
      discountAmount,
      payIfEarly: value - discountAmount,
      annualCost,
      hasDiscount: dPct > 0,
    };
  }, [amount, invoiceDate, netDays, discountPct, discountDays, lang]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label={t("ptInvoiceAmount")} value={amount} onChange={setAmount} prefix="₹" />
        <label className="block">
          <span className="text-sm font-semibold text-ink">{t("ptInvoiceDate")}</span>
          <div className="mt-2 flex items-center rounded-xl border border-muted-line/40 bg-white px-4 transition focus-within:border-indigo">
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full bg-transparent py-3 text-base text-ink outline-none"
            />
          </div>
        </label>
        <NumberField
          label={t("ptNetDays")}
          value={netDays}
          onChange={setNetDays}
          suffix={t("unitDays")}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {TERM_PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setNetDays(d)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              netDays === d
                ? "border-indigo bg-indigo text-cream-paper"
                : "border-muted-line/40 text-ink/70 hover:border-indigo/40 hover:text-ink"
            }`}
          >
            {fill(t("ptNetPreset"), { days: d })}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <NumberField
          label={t("ptEarlyDiscount")}
          value={discountPct}
          onChange={setDiscountPct}
          suffix="%"
          placeholder={t("ptZeroForNone")}
        />
        <NumberField
          label={t("ptDiscountWindow")}
          value={discountDays}
          onChange={setDiscountDays}
          suffix={t("unitDays")}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat label={t("ptDueDate")} value={result.dueDate} emphasis />
        <ResultStat
          label={t("ptPayEarlyBy")}
          value={result.hasDiscount ? result.discountDate : "—"}
        />
        <ResultStat
          label={t("ptEarlySaves")}
          value={result.hasDiscount ? formatCurrency(result.discountAmount) : "—"}
        />
        <ResultStat
          label={t("ptCostOfSkipping")}
          value={
            result.hasDiscount
              ? fill(t("ptPerYear"), { pct: formatNumber(result.annualCost, 1) })
              : "—"
          }
        />
      </div>

      <p className="mt-4 text-sm text-muted">{t("ptFootnote")}</p>
    </div>
  );
}
