"use client";

import { useMemo } from "react";
import { Card, Field, SecondaryButton, TextInput } from "@/components/toolkit/ui";
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useLocalStore } from "@/lib/hooks/useLocalStore";
import { useFinanceWorkspace } from "@/lib/hooks/useFinanceWorkspace";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
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

type BsState = {
  businessName: string;
  asOf: string;
  currentAssets: StatementLine[];
  fixedAssets: StatementLine[];
  currentLiabilities: StatementLine[];
  longTermLiabilities: StatementLine[];
  equity: StatementLine[];
};

const INITIAL: BsState = {
  businessName: "",
  asOf: "",
  currentAssets: [blankLine("Cash & bank"), blankLine("Accounts receivable"), blankLine("Inventory")],
  fixedAssets: [blankLine("Equipment & furniture")],
  currentLiabilities: [blankLine("Accounts payable"), blankLine("GST payable")],
  longTermLiabilities: [blankLine("Loans payable")],
  equity: [blankLine("Owner's capital"), blankLine("Retained earnings")],
};

export function BalanceSheetTool() {
  const { code: currency } = usePreferredCurrency();
  const workspace = useFinanceWorkspace("balance-sheet");
  const [state, setState] = useLocalStore<BsState>("setu-stmt-bs", INITIAL);
  const money = (v: number) => formatMoney(v, currency);
  const patch = (p: Partial<BsState>) => setState((s) => ({ ...s, ...p }));

  // Fill the figures we can derive: cash from the cash book's net position,
  // receivables from customers who still owe on their ledger.
  const pullFromWorkspace = () => {
    const cash = workspace.cashEntries.reduce(
      (s, e) => s + (e.type === "in" ? e.amount : -e.amount),
      0
    );
    const balByCustomer = new Map<string, number>();
    for (const e of workspace.ledger) {
      const signed = e.type === "credit" ? e.amount : -e.amount;
      balByCustomer.set(e.customerId, (balByCustomer.get(e.customerId) ?? 0) + signed);
    }
    const receivables = [...balByCustomer.values()].reduce((s, b) => s + Math.max(0, b), 0);

    setState((s) => ({
      ...s,
      businessName: s.businessName || workspace.business?.name || "",
      currentAssets: [
        { id: generateId(), label: "Cash & bank", amount: cash },
        { id: generateId(), label: "Accounts receivable", amount: receivables },
        ...s.currentAssets.filter(
          (l) => l.label !== "Cash & bank" && l.label !== "Accounts receivable"
        ),
      ],
    }));
  };

  const r = useMemo(() => {
    const currentAssets = sumLines(state.currentAssets);
    const fixedAssets = sumLines(state.fixedAssets);
    const totalAssets = currentAssets + fixedAssets;
    const currentLiabilities = sumLines(state.currentLiabilities);
    const longTermLiabilities = sumLines(state.longTermLiabilities);
    const totalLiabilities = currentLiabilities + longTermLiabilities;
    const equity = sumLines(state.equity);
    const totalLiabEquity = totalLiabilities + equity;
    const difference = totalAssets - totalLiabEquity;
    return {
      currentAssets,
      fixedAssets,
      totalAssets,
      currentLiabilities,
      longTermLiabilities,
      totalLiabilities,
      equity,
      totalLiabEquity,
      difference,
      balanced: Math.abs(difference) < 0.005,
    };
  }, [state]);

  const section = (lines: StatementLine[]) =>
    lines.filter((l) => l.label).map((l) => ({ label: l.label, value: money(l.amount) }));

  const print = () => {
    const rows: PrintRow[] = [
      { label: "Assets — Current", value: "", kind: "heading" },
      ...section(state.currentAssets),
      { label: "Total current assets", value: money(r.currentAssets), kind: "subtotal" },
      { label: "Assets — Fixed / Non-current", value: "", kind: "heading" },
      ...section(state.fixedAssets),
      { label: "Total fixed assets", value: money(r.fixedAssets), kind: "subtotal" },
      { label: "Total assets", value: money(r.totalAssets), kind: "total" },
      { label: "Liabilities — Current", value: "", kind: "heading" },
      ...section(state.currentLiabilities),
      { label: "Total current liabilities", value: money(r.currentLiabilities), kind: "subtotal" },
      { label: "Liabilities — Long-term", value: "", kind: "heading" },
      ...section(state.longTermLiabilities),
      { label: "Total liabilities", value: money(r.totalLiabilities), kind: "subtotal" },
      { label: "Equity", value: "", kind: "heading" },
      ...section(state.equity),
      { label: "Total equity", value: money(r.equity), kind: "subtotal" },
      { label: "Total liabilities & equity", value: money(r.totalLiabEquity), kind: "total" },
    ];
    printStatement({
      docTitle: "Balance Sheet",
      businessName: state.businessName,
      periodLabel: state.asOf ? `As of ${state.asOf}` : "As of date",
      rows,
    });
  };

  const exportCsv = () => {
    const rows: unknown[][] = [];
    const push = (sec: string, lines: StatementLine[]) =>
      lines.filter((l) => l.label).forEach((l) => rows.push([sec, l.label, l.amount.toFixed(2)]));
    push("Current assets", state.currentAssets);
    push("Fixed assets", state.fixedAssets);
    push("Current liabilities", state.currentLiabilities);
    push("Long-term liabilities", state.longTermLiabilities);
    push("Equity", state.equity);
    rows.push(["Totals", "Total assets", r.totalAssets.toFixed(2)]);
    rows.push(["Totals", "Total liabilities & equity", r.totalLiabEquity.toFixed(2)]);
    downloadCsv("balance-sheet.csv", toCsv(["Section", "Item", "Amount"], rows));
  };

  return (
    <div>
      <WorkspaceBanner
        connection={workspace}
        message="Pull cash from your cash book and receivables from outstanding customer udhaar."
      />

      <div className="grid gap-6 lg:grid-cols-2">
      <Card className="h-fit">
        {workspace.connected ? (
          <div className="mb-4">
            <SecondaryButton onClick={pullFromWorkspace}>
              ↻ Pull cash &amp; receivables from workspace
            </SecondaryButton>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name">
            <TextInput
              value={state.businessName}
              onChange={(e) => patch({ businessName: e.target.value })}
            />
          </Field>
          <Field label="As of date">
            <TextInput type="date" value={state.asOf} onChange={(e) => patch({ asOf: e.target.value })} />
          </Field>
        </div>
        <div className="mt-6 space-y-6">
          <LineSectionEditor
            title="Current assets"
            lines={state.currentAssets}
            onChange={(currentAssets) => patch({ currentAssets })}
          />
          <LineSectionEditor
            title="Fixed / non-current assets"
            lines={state.fixedAssets}
            onChange={(fixedAssets) => patch({ fixedAssets })}
          />
          <LineSectionEditor
            title="Current liabilities"
            lines={state.currentLiabilities}
            onChange={(currentLiabilities) => patch({ currentLiabilities })}
          />
          <LineSectionEditor
            title="Long-term liabilities"
            lines={state.longTermLiabilities}
            onChange={(longTermLiabilities) => patch({ longTermLiabilities })}
          />
          <LineSectionEditor
            title="Equity"
            lines={state.equity}
            onChange={(equity) => patch({ equity })}
          />
        </div>
      </Card>

      <Card className="h-fit lg:sticky lg:top-24">
        <h2 className="mb-4 text-lg font-bold text-ink">Balance check</h2>
        <div className="space-y-2 text-sm">
          <Row label="Current assets" value={money(r.currentAssets)} />
          <Row label="Fixed assets" value={money(r.fixedAssets)} />
          <Row label="Total assets" value={money(r.totalAssets)} strong />
          <Row label="Current liabilities" value={money(r.currentLiabilities)} />
          <Row label="Long-term liabilities" value={money(r.longTermLiabilities)} />
          <Row label="Total equity" value={money(r.equity)} />
          <Row label="Liabilities + equity" value={money(r.totalLiabEquity)} strong />
        </div>

        <div
          className={`mt-4 rounded-xl p-4 ${r.balanced ? "bg-emerald-100" : "bg-red-50"}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {r.balanced ? "Balanced" : "Out of balance"}
          </p>
          <p
            className={`mt-1 text-xl font-bold ${r.balanced ? "text-emerald-700" : "text-red-600"}`}
          >
            {r.balanced ? "Assets = Liabilities + Equity ✓" : `Difference: ${money(r.difference)}`}
          </p>
          {!r.balanced ? (
            <p className="mt-1 text-xs text-muted">
              A common fix: the gap is usually retained earnings (accumulated profit) missing from
              equity.
            </p>
          ) : null}
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
