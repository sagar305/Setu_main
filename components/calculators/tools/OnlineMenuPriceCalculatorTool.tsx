"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, formatNumber, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";

export function OnlineMenuPriceCalculatorTool() {
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
        <NumberField label="Price you want to take home" value={takeHome} onChange={setTakeHome} prefix="₹" />
        <NumberField label="Platform commission" value={commissionPct} onChange={setCommissionPct} suffix="%" />
        <NumberField label="GST on commission" value={commissionGstPct} onChange={setCommissionGstPct} suffix="%" />
        <NumberField label="Payment gateway fee" value={gatewayPct} onChange={setGatewayPct} suffix="%" />
        <NumberField label="Packaging cost" value={packaging} onChange={setPackaging} prefix="₹" />
        <NumberField label="GST you charge on this item" value={itemGstPct} onChange={setItemGstPct} suffix="%" />
      </div>

      {result.feasible ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ResultStat label="Price to list on the platform" value={formatCurrency(result.menuPrice)} emphasis />
            <ResultStat label="Markup over your target price" value={`${formatNumber(result.markupPct)}%`} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <ResultStat label="GST you'll remit" value={formatCurrency(result.outputGst)} />
            <ResultStat label="Commission + GST on it" value={formatCurrency(result.commissionAmount)} />
            <ResultStat label="Gateway fee + packaging" value={formatCurrency(result.gatewayFee + parseNumber(packaging))} />
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-xl bg-saffron/15 p-4 text-sm text-ink">
          Commission, GST and fees together add up to 100% or more of the listed price, so no menu price can recover your
          target take-home on this item. Try lowering the commission or fee inputs, or reconsider listing this item online
          at this margin.
        </div>
      )}

      <p className="mt-4 text-sm text-muted-warm">
        Assumes commission and gateway fees are charged on the listed price, and that the listed price already includes
        the GST you charge on the item. Aggregator agreements vary — verify against an actual payout report before
        rolling out new prices.
      </p>
    </div>
  );
}
