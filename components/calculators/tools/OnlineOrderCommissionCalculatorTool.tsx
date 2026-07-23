"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, formatNumber, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";

export function OnlineOrderCommissionCalculatorTool() {
  const { t } = useI18n();
  usePreferredCurrency(); // re-render when the business currency changes
  const [orderValue, setOrderValue] = useState("500");
  const [commissionPct, setCommissionPct] = useState("25");
  const [packaging, setPackaging] = useState("20");
  const [gatewayPct, setGatewayPct] = useState("2");
  const [commissionGstPct, setCommissionGstPct] = useState("18");

  const result = useMemo(() => {
    const order = parseNumber(orderValue);
    const commission = order * (parseNumber(commissionPct) / 100);
    const gstOnCommission = commission * (parseNumber(commissionGstPct) / 100);
    const gatewayFee = order * (parseNumber(gatewayPct) / 100);
    const pack = parseNumber(packaging);
    const totalDeductions = commission + gstOnCommission + gatewayFee + pack;
    const payout = order - totalDeductions;
    const payoutPct = order > 0 ? (payout / order) * 100 : 0;
    return { totalDeductions, payout, payoutPct };
  }, [orderValue, commissionPct, packaging, gatewayPct, commissionGstPct]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label={t("oocOrderValue")} value={orderValue} onChange={setOrderValue} prefix="₹" />
        <NumberField label={t("ompCommission")} value={commissionPct} onChange={setCommissionPct} suffix="%" />
        <NumberField label={t("ompGstOnComm")} value={commissionGstPct} onChange={setCommissionGstPct} suffix="%" />
        <NumberField label={t("ompGatewayFee")} value={gatewayPct} onChange={setGatewayPct} suffix="%" />
        <NumberField label={t("ompPackaging")} value={packaging} onChange={setPackaging} prefix="₹" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat label={t("oocTotalDeductions")} value={formatCurrency(result.totalDeductions)} />
        <ResultStat label={t("oocRealPayout")} value={formatCurrency(result.payout)} emphasis />
      </div>
      <div className="mt-4">
        <ResultStat label={t("oocTakeHomePct")} value={`${formatNumber(result.payoutPct)}%`} />
      </div>
    </div>
  );
}
