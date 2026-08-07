"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatNumber, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";

export function FinancialRatioCalculatorTool() {
  usePreferredCurrency(); // re-render when the business currency changes
  const [currentAssets, setCurrentAssets] = useState("800000");
  const [inventory, setInventory] = useState("300000");
  const [currentLiabilities, setCurrentLiabilities] = useState("400000");
  const [totalDebt, setTotalDebt] = useState("500000");
  const [equity, setEquity] = useState("1000000");
  const [revenue, setRevenue] = useState("2400000");
  const [cogs, setCogs] = useState("1500000");
  const [netProfit, setNetProfit] = useState("240000");
  const [receivables, setReceivables] = useState("200000");

  const r = useMemo(() => {
    const ca = parseNumber(currentAssets);
    const inv = parseNumber(inventory);
    const cl = parseNumber(currentLiabilities);
    const debt = parseNumber(totalDebt);
    const eq = parseNumber(equity);
    const rev = parseNumber(revenue);
    const cost = parseNumber(cogs);
    const profit = parseNumber(netProfit);
    const ar = parseNumber(receivables);

    const safe = (num: number, den: number) => (den !== 0 ? num / den : 0);
    return {
      current: safe(ca, cl),
      quick: safe(ca - inv, cl),
      debtToEquity: safe(debt, eq),
      grossMargin: safe(rev - cost, rev) * 100,
      netMargin: safe(profit, rev) * 100,
      inventoryTurnover: safe(cost, inv),
      receivableDays: rev > 0 ? (ar / rev) * 365 : 0,
    };
  }, [currentAssets, inventory, currentLiabilities, totalDebt, equity, revenue, cogs, netProfit, receivables]);

  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Balance sheet figures</h3>
      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        <NumberField label="Current assets" value={currentAssets} onChange={setCurrentAssets} prefix="₹" />
        <NumberField label="Inventory (stock)" value={inventory} onChange={setInventory} prefix="₹" />
        <NumberField
          label="Current liabilities"
          value={currentLiabilities}
          onChange={setCurrentLiabilities}
          prefix="₹"
        />
        <NumberField label="Accounts receivable" value={receivables} onChange={setReceivables} prefix="₹" />
        <NumberField label="Total debt" value={totalDebt} onChange={setTotalDebt} prefix="₹" />
        <NumberField label="Owner's equity" value={equity} onChange={setEquity} prefix="₹" />
      </div>

      <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">P&amp;L figures (annual)</h3>
      <div className="mt-3 grid gap-5 sm:grid-cols-3">
        <NumberField label="Revenue" value={revenue} onChange={setRevenue} prefix="₹" />
        <NumberField label="Cost of goods sold" value={cogs} onChange={setCogs} prefix="₹" />
        <NumberField label="Net profit" value={netProfit} onChange={setNetProfit} prefix="₹" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat label="Current ratio" value={formatNumber(r.current, 2)} emphasis />
        <ResultStat label="Quick ratio" value={formatNumber(r.quick, 2)} />
        <ResultStat label="Debt to equity" value={formatNumber(r.debtToEquity, 2)} />
        <ResultStat label="Gross margin" value={`${formatNumber(r.grossMargin, 1)}%`} />
        <ResultStat label="Net margin" value={`${formatNumber(r.netMargin, 1)}%`} />
        <ResultStat label="Inventory turnover" value={`${formatNumber(r.inventoryTurnover, 1)}×`} />
        <ResultStat label="Receivable days (DSO)" value={`${formatNumber(r.receivableDays, 0)} days`} />
      </div>

      <p className="mt-4 text-sm text-muted">
        Rules of thumb: a current ratio of 1.5–3 and quick ratio above 1 signal healthy liquidity; a
        debt-to-equity under 2 is comfortable for most small businesses; and receivable days show
        how long customers take to pay you on average.
      </p>
    </div>
  );
}
