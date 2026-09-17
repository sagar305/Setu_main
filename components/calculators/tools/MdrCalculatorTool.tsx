"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { SegmentedControl } from "@/components/calculators/SegmentedControl";
import { formatCurrency, formatNumber, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";
import { calculateMdr, MDR_PRESETS, type MdrMode } from "@/lib/mdr";

export function MdrCalculatorTool() {
  const { t } = useI18n();
  usePreferredCurrency(); // re-render when the business currency changes
  const [mode, setMode] = useState<MdrMode>("inclusive");
  const [amount, setAmount] = useState("5000");
  const [presetId, setPresetId] = useState("credit");
  const [ratePct, setRatePct] = useState("2");
  const [fixedFee, setFixedFee] = useState("0");
  const [gstPct, setGstPct] = useState("18");

  // Picking a preset fills the rate in but leaves it editable, since the rate
  // that matters is the one on the merchant's own acquirer agreement.
  function applyPreset(id: string) {
    setPresetId(id);
    const preset = MDR_PRESETS.find((p) => p.id === id);
    if (preset && preset.ratePct !== null) setRatePct(String(preset.ratePct));
  }

  const result = useMemo(
    () =>
      calculateMdr({
        amount: parseNumber(amount),
        mode,
        ratePct: parseNumber(ratePct),
        fixedFee: parseNumber(fixedFee),
        gstPct: parseNumber(gstPct),
      }),
    [amount, mode, ratePct, fixedFee, gstPct],
  );

  const preset = MDR_PRESETS.find((p) => p.id === presetId);
  const isZeroMdr = result.feasible && result.totalDeduction === 0 && result.customerPays > 0;

  // The splitter works off the amount the customer actually pays, so a grossed-up
  // "exclusive" figure carries through rather than the net the merchant typed.
  const splitHref = `/tools/upi-qr-split?amount=${encodeURIComponent(
    result.customerPays > 0 ? result.customerPays.toFixed(2) : "",
  )}`;

  return (
    <div>
      <div className="mb-5">
        <span className="text-sm font-semibold text-ink">{t("mdrMode")}</span>
        <div className="mt-2">
          <SegmentedControl<MdrMode>
            options={[
              { label: t("mdrModeInclusive"), value: "inclusive" },
              { label: t("mdrModeExclusive"), value: "exclusive" },
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField
          label={mode === "inclusive" ? t("mdrAmountInclusive") : t("mdrAmountExclusive")}
          value={amount}
          onChange={setAmount}
          prefix="₹"
        />

        <label className="block">
          <span className="text-sm font-semibold text-ink">{t("mdrInstrument")}</span>
          <div className="mt-2 flex items-center rounded-xl border border-muted-line/40 bg-white px-4 transition focus-within:border-indigo">
            <select
              value={presetId}
              onChange={(e) => applyPreset(e.target.value)}
              className="w-full bg-transparent py-3 text-base text-ink outline-none"
            >
              {MDR_PRESETS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </label>

        <NumberField label={t("mdrRate")} value={ratePct} onChange={setRatePct} suffix="%" />
        <NumberField label={t("mdrGstOnFee")} value={gstPct} onChange={setGstPct} suffix="%" />
        <NumberField label={t("mdrFixedFee")} value={fixedFee} onChange={setFixedFee} prefix="₹" />
      </div>

      {preset?.note && <p className="mt-3 text-sm text-muted">{preset.note}</p>}

      {!result.feasible ? (
        <p className="mt-6 rounded-xl bg-cream p-4 text-sm text-muted">{t("mdrInfeasible")}</p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ResultStat label={t("mdrCustomerPays")} value={formatCurrency(result.customerPays)} />
            <ResultStat label={t("mdrYouReceive")} value={formatCurrency(result.youReceive)} emphasis />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <ResultStat label={t("mdrFee")} value={formatCurrency(result.mdrFee)} />
            <ResultStat label={t("mdrGstAmount")} value={formatCurrency(result.gstOnMdr)} />
            <ResultStat label={t("mdrTotalDeduction")} value={formatCurrency(result.totalDeduction)} />
          </div>

          <div className="mt-4">
            <ResultStat
              label={t("mdrEffectivePct")}
              value={`${formatNumber(result.effectivePct, 2)}%`}
            />
          </div>

          {isZeroMdr && <p className="mt-4 text-sm text-muted">{t("mdrZeroNote")}</p>}
        </>
      )}

      {result.feasible && result.customerPays > 0 && (
        <div className="mt-6 rounded-xl border border-indigo/20 bg-indigo/5 p-5">
          <p className="text-sm text-muted">{t("mdrSplitPitch")}</p>
          <Link
            href={splitHref}
            className="mt-3 inline-block rounded-full bg-indigo px-5 py-2.5 text-sm font-semibold text-cream-paper transition hover:bg-indigo/90"
          >
            {t("mdrSplitCta")} →
          </Link>
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-muted-warm">{t("mdrAssumption")}</p>
    </div>
  );
}
