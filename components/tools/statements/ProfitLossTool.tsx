"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Field, NumberInput, SecondaryButton, TextInput } from "@/components/toolkit/ui";
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useLocalStore } from "@/lib/hooks/useLocalStore";
import { useFinanceWorkspace } from "@/lib/hooks/useFinanceWorkspace";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";
import { relabelSeedLines } from "@/lib/i18n/seed-labels";
import { fill, translate, type TKey } from "@/lib/i18n/translate";
import type { LanguageCode } from "@/lib/i18n/config";
import { formatMoney, generateId } from "@/lib/pos/types";
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

// The starting line labels are the user's to edit, so they begin in the
// user's own language rather than making them translate the form away.
const SEED_KEYS: TKey[] = [
  "stSeedSales",
  "stSeedPurchasesMaterials",
  "stSeedRent",
  "stSeedSalaries",
  "stOtherIncome",
  "stSeedPurchases",
];

const SEEDED_FIELDS = [
  "revenue",
  "cogs",
  "expenses",
  "otherIncome",
] as const satisfies readonly (keyof PlState)[];

const initialState = (lang: LanguageCode): PlState => {
  const seed = (key: TKey) => blankLine(translate(lang, key));
  return {
    businessName: "",
    period: "",
    revenue: [seed("stSeedSales")],
    cogs: [seed("stSeedPurchasesMaterials")],
    expenses: [seed("stSeedRent"), seed("stSeedSalaries")],
    otherIncome: [seed("stOtherIncome")],
    tax: 0,
  };
};

export function ProfitLossTool() {
  const { code: currency } = usePreferredCurrency();
  const workspace = useFinanceWorkspace("profit-loss-statement");
  const { t, lang } = useI18n();
  const [initial] = useState(() => initialState(lang));
  const [state, setState, loaded] = useLocalStore<PlState>("setu-stmt-pl", initial);

  // The starting lines are sample text, not the reader's: ones they have not
  // touched follow the language they are reading in, however the saved sheet
  // got here. Lines they typed are left exactly as they wrote them.
  useEffect(() => {
    if (!loaded) return;
    setState((s) => {
      let changed = false;
      const next = { ...s };
      for (const field of SEEDED_FIELDS) {
        const lines = relabelSeedLines(s[field], SEED_KEYS, lang);
        if (lines !== s[field]) {
          next[field] = lines;
          changed = true;
        }
      }
      return changed ? next : s;
    });
  }, [loaded, lang, setState]);


  const money = (v: number) => formatMoney(v, currency);

  // Build the P&L from recorded workspace data: net sales from completed
  // orders, COGS from purchases, and expenses grouped by category.
  const pullFromWorkspace = () => {
    const completed = workspace.orders.filter((o) => o.status === "completed");
    const netSales = completed.reduce((s, o) => s + (o.subtotal - o.discountAmount), 0);
    const purchasesTotal = workspace.purchases.reduce((s, p) => s + p.total, 0);

    const byCategory = new Map<string, number>();
    for (const e of workspace.expenses) {
      // Purchases logged as expenses are already counted under COGS.
      if (e.category === "Purchases") continue;
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
    }
    const expenseLines: StatementLine[] = [...byCategory.entries()].map(([label, amount]) => ({
      id: generateId(),
      label,
      amount,
    }));

    setState((s) => ({
      ...s,
      businessName: s.businessName || workspace.business?.name || "",
      revenue: [{ id: generateId(), label: t("stSeedSales"), amount: netSales }],
      cogs: [{ id: generateId(), label: t("stSeedPurchases"), amount: purchasesTotal }],
      expenses: expenseLines.length > 0 ? expenseLines : s.expenses,
    }));
  };

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
      { label: t("revenue"), value: "", kind: "heading" },
      ...state.revenue.filter((l) => l.label).map((l) => ({ label: l.label, value: money(l.amount) })),
      { label: t("stTotalRevenue"), value: money(r.revenue), kind: "subtotal" as const },
      { label: t("stCogs"), value: "", kind: "heading" },
      ...state.cogs.filter((l) => l.label).map((l) => ({ label: l.label, value: money(l.amount) })),
      { label: t("stTotalCogs"), value: money(r.cogs), kind: "subtotal" as const },
      { label: t("stGrossProfit"), value: money(r.grossProfit), kind: "subtotal" },
      { label: t("stOperatingExpenses"), value: "", kind: "heading" },
      ...state.expenses.filter((l) => l.label).map((l) => ({ label: l.label, value: money(l.amount) })),
      { label: t("stTotalOperatingExpenses"), value: money(r.expenses), kind: "subtotal" as const },
      { label: t("stOperatingProfit"), value: money(r.operatingProfit), kind: "subtotal" },
      { label: t("stOtherIncome"), value: "", kind: "heading" },
      ...state.otherIncome.filter((l) => l.label).map((l) => ({ label: l.label, value: money(l.amount) })),
      { label: t("stProfitBeforeTax"), value: money(r.profitBeforeTax), kind: "subtotal" },
      { label: t("taxLabel"), value: money(state.tax || 0) },
      { label: t("stNetProfit"), value: money(r.netProfit), kind: "total" },
    ];
    printStatement({
      docTitle: t("stPlTitle"),
      businessName: state.businessName,
      periodLabel: state.period || t("stForThePeriod"),
      rows,
      lang,
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
    <div>
      <WorkspaceBanner
        connection={workspace}
        message={t("stPlWorkspaceMsg")}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card className="h-fit">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("spBusinessName")}>
            <TextInput
              value={state.businessName}
              onChange={(e) => patch({ businessName: e.target.value })}
            />
          </Field>
          <Field label={t("bvaPeriod")}>
            <TextInput
              value={state.period}
              onChange={(e) => patch({ period: e.target.value })}
              placeholder={t("stPeriodPlaceholder")}
            />
          </Field>
        </div>

        {workspace.connected ? (
          <div className="mt-4">
            <SecondaryButton onClick={pullFromWorkspace}>
              ↻ {t("stPlPullBtn")}
            </SecondaryButton>
          </div>
        ) : null}

        <div className="mt-6 space-y-6">
          <LineSectionEditor
            title={t("revenue")}
            lines={state.revenue}
            onChange={(revenue) => patch({ revenue })}
          />
          <LineSectionEditor
            title={t("stCogs")}
            lines={state.cogs}
            onChange={(cogs) => patch({ cogs })}
          />
          <LineSectionEditor
            title={t("stOperatingExpenses")}
            lines={state.expenses}
            onChange={(expenses) => patch({ expenses })}
          />
          <LineSectionEditor
            title={t("stOtherIncome")}
            lines={state.otherIncome}
            onChange={(otherIncome) => patch({ otherIncome })}
          />
          <div className="max-w-[220px]">
            <Field label={t("stTaxOnProfit")}>
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
        <h2 className="mb-4 text-lg font-bold text-ink">{t("stStatement")}</h2>
        <div className="space-y-2 text-sm">
          <Row label={t("stTotalRevenue")} value={money(r.revenue)} />
          <Row label={t("stCogs")} value={`− ${money(r.cogs)}`} />
          <Row label={t("stGrossProfit")} value={money(r.grossProfit)} strong />
          <Row label={t("stOperatingExpenses")} value={`− ${money(r.expenses)}`} />
          <Row label={t("stOperatingProfit")} value={money(r.operatingProfit)} strong />
          <Row label={t("stOtherIncome")} value={`+ ${money(r.otherIncome)}`} />
          <Row label={t("taxLabel")} value={`− ${money(state.tax || 0)}`} />
          <div
            className={`mt-2 rounded-xl p-4 ${r.netProfit >= 0 ? "bg-emerald-100" : "bg-red-50"}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("stNetProfit")}
            </p>
            <p
              className={`mt-1 text-2xl font-bold ${
                r.netProfit >= 0 ? "text-emerald-700" : "text-red-600"
              }`}
            >
              {money(r.netProfit)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {fill(t("stMarginLine"), {
                gross: r.grossMarginPct.toFixed(1),
                net: r.netMarginPct.toFixed(1),
              })}
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <SecondaryButton className="flex-1" onClick={print}>
            {t("qgPrintPdf")}
          </SecondaryButton>
          <SecondaryButton className="flex-1" onClick={exportCsv}>
            {t("exportCsv")}
          </SecondaryButton>
        </div>
        <p className="mt-3 text-xs text-muted">{t("stSavedAuto")}</p>
      </Card>
      </div>
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
