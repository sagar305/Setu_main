"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, formatNumber, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";

export function OnlineMenuPriceCalculatorTool() {
  const { t } = useI18n();
  usePreferredCurrency(); // re-render when the business currency changes
  const [takeHome, setTakeHome] = useState("200");
  const [commissionPct, setCommissionPct] = useState("25");
  const [commissionGstPct, setCommissionGstPct] = useState("18");
  const [gatewayPct, setGatewayPct] = useState("2");
  const [packaging, setPackaging] = useState("20");
  const [itemGstPct, setItemGstPct] = useState("5");

  const result = useMemo(() => {
    const target = parseNumber(takeHome);
    const commission = parseNumber(commissionPct) / 100;
    const commissionGst = parseNumber(commissionGstPct) / 100;
    const gateway = parseNumber(gatewayPct) / 100;
    const itemGst = parseNumber(itemGstPct) / 100;
    const pack = parseNumber(packaging);

    const outputGstShare = itemGst / (1 + itemGst);
    const denom = 1 - outputGstShare - commission * (1 + commissionGst) - gateway;

    if (denom <= 0) {
      return { feasible: false, menuPrice: 0, outputGst: 0, commissionAmount: 0, gatewayFee: 0, totalDeductions: 0, markupPct: 0 };
    }

    const menuPrice = (target + pack) / denom;
    const outputGst = menuPrice * outputGstShare;
    const commissionAmount = menuPrice * commission;
    const gstOnCommission = commissionAmount * commissionGst;
    const gatewayFee = menuPrice * gateway;
    const totalDeductions = outputGst + commissionAmount + gstOnCommission + gatewayFee + pack;
    const markupPct = target > 0 ? ((menuPrice - target) / target) * 100 : 0;

    return { feasible: true, menuPrice, outputGst, commissionAmount: commissionAmount + gstOnCommission, gatewayFee, totalDeductions, markupPct };
  }, [takeHome, commissionPct, commissionGstPct, gatewayPct, packaging, itemGstPct]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label={t("ompTakeHome")} value={takeHome} onChange={setTakeHome} prefix="₹" />
        <NumberField label={t("ompCommission")} value={commissionPct} onChange={setCommissionPct} suffix="%" />
        <NumberField label={t("ompGstOnComm")} value={commissionGstPct} onChange={setCommissionGstPct} suffix="%" />
        <NumberField label={t("ompGatewayFee")} value={gatewayPct} onChange={setGatewayPct} suffix="%" />
        <NumberField label={t("ompPackaging")} value={packaging} onChange={setPackaging} prefix="₹" />
        <NumberField label={t("ompGstCharge")} value={itemGstPct} onChange={setItemGstPct} suffix="%" />
      </div>

      {result.feasible ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ResultStat label={t("ompListPrice")} value={formatCurrency(result.menuPrice)} emphasis />
            <ResultStat label={t("ompMarkup")} value={`${formatNumber(result.markupPct)}%`} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <ResultStat label={t("ompGstRemit")} value={formatCurrency(result.outputGst)} />
            <ResultStat label={t("ompCommPlusGst")} value={formatCurrency(result.commissionAmount)} />
            <ResultStat label={t("ompGatewayPackaging")} value={formatCurrency(result.gatewayFee + parseNumber(packaging))} />
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-xl bg-saffron/15 p-4 text-sm text-ink">
          {t("ompInfeasible")}
        </div>
      )}

      <p className="mt-4 text-sm text-muted-warm">
        {t("ompAssumption")}
      </p>
    </div>
  );
}
