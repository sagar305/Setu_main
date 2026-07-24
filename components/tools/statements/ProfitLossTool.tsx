"use client";

import { useMemo } from "react";
import { Card, Field, NumberInput, SecondaryButton, TextInput } from "@/components/toolkit/ui";
import { useLocalStore } from "@/lib/hooks/useLocalStore";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { formatMoney } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import {
  LineSectionEditor,
  blankLine,
  printStatement,
  sumLines,
  type PrintRow,
  type StatementLine,
} from "@/components/tools/statements/shared";

type PlState = {
  businessName: string;
  period: string;
  revenue: StatementLine[];
  cogs: StatementLine[];
  expenses: StatementLine[];
  otherIncome: StatementLine[];
  tax: number;
};

const INITIAL: PlState = {
  businessName: "",
  period: "",
  revenue: [blankLine("Sales")],
  cogs: [blankLine("Purchases / materials")],
  expenses: [blankLine("Rent"), blankLine("Salaries & wages")],
  otherIncome: [blankLine("Other income")],
  tax: 0,
};

export function ProfitLossTool() {
  const { code: currency } = usePreferredCurrency();
  const [state, setState] = useLocalStore<PlState>("setu-stmt-pl", INITIAL);

  const money = (v: number) => formatMoney(v, currency);

  const r = useMemo(() => {
    const revenue = sumLines(state.revenue);
    const cogs = sumLines(state.cogs);
    const grossProfit = revenue - cogs;
    const expenses = sumLines(state.expenses);
    const operatingProfit = grossProfit - expenses;
    const otherIncome = sumLines(state.otherIncome);
    const profitBeforeTax = operatingProfit + otherIncome;
    const netProfit = profitBeforeTax - (state.tax || 0);
    const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const netMarginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    return { revenue, cogs, grossProfit, expenses, operatingProfit, otherIncome, profitBeforeTax, netProfit, grossMarginPct, netMarginPct };
  }, [state]);

  const patch = (p: Partial<PlState>) => setState((s) => ({ ...s, ...p }));

  const print = () => {
    const rows: PrintRow[] = [
      { label: "Revenue", value: "", kind: "heading" },
      ...state.revenue.filter((l) => l.label).map((l) => ({ label: l.label, value: money(l.amount) })),
      { label: "Total revenue", value: money(r.revenue), kind: "subtotal" as const },
      { label: "Cost of goods sold", value: "", kind: "heading" },
      ...state.cogs.filter((l) => l.label).map((l) => ({ label: l.label, value: money(l.amount) })),
      { label: "Total cost of goods sold", value: money(r.cogs), kind: "subtotal" as const },
      { label: "Gross profit", value: money(r.grossProfit), kind: "subtotal" },
      { label: "Operating expenses", value: "", kind: "heading" },
      ...state.expenses.filter((l) => l.label).map((l) => ({ label: l.label, value: money(l.amount) })),
      { label: "Total operating expenses", value: money(r.expenses), kind: "subtotal" as const },
      { label: "Operating profit", value: money(r.operatingProfit), kind: "subtotal" },
      { label: "Other income", value: "", kind: "heading" },
      ...state.otherIncome.filter((l) => l.label).map((l) => ({ label: l.label, value: money(l.amount) })),
      { label: "Profit before tax", value: money(r.profitBeforeTax), kind: "subtotal" },
      { label: "Tax", value: money(state.tax || 0) },
      { label: "Net profit", value: money(r.netProfit), kind: "total" },
    ];
    printStatement({
      docTitle: "Profit & Loss Statement",
      businessName: state.businessName,
      periodLabel: state.period || "For the period",
      rows,
    });
  };

  const exportCsv = () => {
    const rows: unknown[][] = [];
    const push = (section: string, lines: StatementLine[]) =>
      lines.filter((l) => l.label).forEach((l) => rows.push([section, l.label, l.amount.toFixed(2)]));
    push("Revenue", state.revenue);
    push("COGS", state.cogs);
    push("Operating expenses", state.expenses);
    push("Other income", state.otherIncome);
    rows.push(["Tax", "Tax", (state.tax || 0).toFixed(2)]);
    rows.push(["Result", "Gross profit", r.grossProfit.toFixed(2)]);
    rows.push(["Result", "Operating profit", r.operatingProfit.toFixed(2)]);
    rows.push(["Result", "Net profit", r.netProfit.toFixed(2)]);
    downloadCsv("profit-and-loss.csv", toCsv(["Section", "Item", "Amount"], rows));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card className="h-fit">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name">
            <TextInput
              value={state.businessName}
              onChange={(e) => patch({ businessName: e.target.value })}
            />
          </Field>
          <Field label="Period">
            <TextInput
              value={state.period}
              onChange={(e) => patch({ period: e.target.value })}
              placeholder="e.g. April 2026 – June 2026"
            />
          </Field>
        </div>

        <div className="mt-6 space-y-6">
          <LineSectionEditor
            title="Revenue"
            lines={state.revenue}
            onChange={(revenue) => patch({ revenue })}
          />
          <LineSectionEditor
            title="Cost of goods sold"
            lines={state.cogs}
            onChange={(cogs) => patch({ cogs })}
          />
          <LineSectionEditor
            title="Operating expenses"
            lines={state.expenses}
            onChange={(expenses) => patch({ expenses })}
          />
          <LineSectionEditor
            title="Other income"
            lines={state.otherIncome}
            onChange={(otherIncome) => patch({ otherIncome })}
          />
          <div className="max-w-[220px]">
            <Field label="Tax on profit">
              <NumberInput
                step="0.01"
                value={state.tax || ""}
                onChange={(e) => patch({ tax: Number(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card className="h-fit lg:sticky lg:top-24">
        <h2 className="mb-4 text-lg font-bold text-ink">Statement</h2>
        <div className="space-y-2 text-sm">
          <Row label="Total revenue" value={money(r.revenue)} />
          <Row label="Cost of goods sold" value={`− ${money(r.cogs)}`} />
          <Row label="Gross profit" value={money(r.grossProfit)} strong />
          <Row label="Operating expenses" value={`− ${money(r.expenses)}`} />
          <Row label="Operating profit" value={money(r.operatingProfit)} strong />
          <Row label="Other income" value={`+ ${money(r.otherIncome)}`} />
          <Row label="Tax" value={`− ${money(state.tax || 0)}`} />
          <div
            className={`mt-2 rounded-xl p-4 ${r.netProfit >= 0 ? "bg-emerald-100" : "bg-red-50"}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Net profit</p>
            <p
              className={`mt-1 text-2xl font-bold ${
                r.netProfit >= 0 ? "text-emerald-700" : "text-red-600"
              }`}
            >
              {money(r.netProfit)}
            </p>
            <p className="mt-1 text-xs text-muted">
              Gross margin {r.grossMarginPct.toFixed(1)}% · Net margin {r.netMarginPct.toFixed(1)}%
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <SecondaryButton className="flex-1" onClick={print}>
            Print / PDF
          </SecondaryButton>
          <SecondaryButton className="flex-1" onClick={exportCsv}>
            Export CSV
          </SecondaryButton>
        </div>
        <p className="mt-3 text-xs text-muted">Saved automatically in this browser as you type.</p>
      </Card>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex justify-between ${strong ? "border-t border-muted-line/40 pt-2 font-bold text-ink" : "text-muted"}`}
    >
      <span>{label}</span>
      <span className={strong ? "" : "text-ink"}>{value}</span>
    </div>
  );
}
