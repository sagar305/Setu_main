"use client";

import { useMemo } from "react";
import { Card, Field, NumberInput, SecondaryButton, TextInput } from "@/components/toolkit/ui";
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

// Amounts are signed: inflows positive, outflows negative.
type CfState = {
  businessName: string;
  period: string;
  openingCash: number;
  operating: StatementLine[];
  investing: StatementLine[];
  financing: StatementLine[];
};

const INITIAL: CfState = {
  businessName: "",
  period: "",
  openingCash: 0,
  operating: [blankLine("Cash from customers"), blankLine("Paid to suppliers (−)")],
  investing: [blankLine("Equipment purchased (−)")],
  financing: [blankLine("Loan received / repaid")],
};

export function CashFlowTool() {
  const { code: currency } = usePreferredCurrency();
  const workspace = useFinanceWorkspace("cash-flow-statement");
  const [state, setState] = useLocalStore<CfState>("setu-stmt-cf", INITIAL);
  const money = (v: number) => formatMoney(v, currency);
  const patch = (p: Partial<CfState>) => setState((s) => ({ ...s, ...p }));

  // Operating cash from the cash book: total in as an inflow, total out as an
  // outflow (negative). Investing/financing stay manual — the cash book
  // doesn't classify them.
  const pullFromWorkspace = () => {
    const cashIn = workspace.cashEntries
      .filter((e) => e.type === "in")
      .reduce((s, e) => s + e.amount, 0);
    const cashOut = workspace.cashEntries
      .filter((e) => e.type === "out")
      .reduce((s, e) => s + e.amount, 0);
    setState((s) => ({
      ...s,
      businessName: s.businessName || workspace.business?.name || "",
      operating: [
        { id: generateId(), label: "Cash received (cash book)", amount: cashIn },
        { id: generateId(), label: "Cash paid out (cash book)", amount: -cashOut },
      ],
    }));
  };

  const r = useMemo(() => {
    const operating = sumLines(state.operating);
    const investing = sumLines(state.investing);
    const financing = sumLines(state.financing);
    const netChange = operating + investing + financing;
    const closingCash = (state.openingCash || 0) + netChange;
    return { operating, investing, financing, netChange, closingCash };
  }, [state]);

  const section = (lines: StatementLine[]) =>
    lines.filter((l) => l.label).map((l) => ({ label: l.label, value: money(l.amount) }));

  const print = () => {
    const rows: PrintRow[] = [
      { label: "Operating activities", value: "", kind: "heading" },
      ...section(state.operating),
      { label: "Net cash from operations", value: money(r.operating), kind: "subtotal" },
      { label: "Investing activities", value: "", kind: "heading" },
      ...section(state.investing),
      { label: "Net cash from investing", value: money(r.investing), kind: "subtotal" },
      { label: "Financing activities", value: "", kind: "heading" },
      ...section(state.financing),
      { label: "Net cash from financing", value: money(r.financing), kind: "subtotal" },
      { label: "Net change in cash", value: money(r.netChange), kind: "subtotal" },
      { label: "Opening cash", value: money(state.openingCash || 0) },
      { label: "Closing cash", value: money(r.closingCash), kind: "total" },
    ];
    printStatement({
      docTitle: "Cash Flow Statement",
      businessName: state.businessName,
      periodLabel: state.period || "For the period",
      rows,
      footNote: "Inflows positive, outflows negative.",
    });
  };

  const exportCsv = () => {
    const rows: unknown[][] = [];
    const push = (sec: string, lines: StatementLine[]) =>
      lines.filter((l) => l.label).forEach((l) => rows.push([sec, l.label, l.amount.toFixed(2)]));
    push("Operating", state.operating);
    push("Investing", state.investing);
    push("Financing", state.financing);
    rows.push(["Summary", "Opening cash", (state.openingCash || 0).toFixed(2)]);
    rows.push(["Summary", "Net change", r.netChange.toFixed(2)]);
    rows.push(["Summary", "Closing cash", r.closingCash.toFixed(2)]);
    downloadCsv("cash-flow-statement.csv", toCsv(["Section", "Item", "Amount"], rows));
  };

  return (
    <div>
      <WorkspaceBanner
        connection={workspace}
        message="Pull operating cash straight from your recorded cash book entries."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card className="h-fit">
        <div className="grid gap-4 sm:grid-cols-3">
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
              placeholder="e.g. FY 2025-26"
            />
          </Field>
          <Field label="Opening cash balance">
            <NumberInput
              step="0.01"
              value={state.openingCash || ""}
              onChange={(e) => patch({ openingCash: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>

        {workspace.connected ? (
          <div className="mt-4">
            <SecondaryButton onClick={pullFromWorkspace}>
              ↻ Pull operating cash from cash book
            </SecondaryButton>
          </div>
        ) : null}

        <p className="mt-4 rounded-xl bg-cream-paper/50 px-4 py-3 text-xs text-muted">
          Enter inflows as positive numbers and outflows as negative (e.g. −25000 for equipment
          bought). Each section then nets itself.
        </p>

        <div className="mt-6 space-y-6">
          <LineSectionEditor
            title="Operating activities (day-to-day trading)"
            lines={state.operating}
            onChange={(operating) => patch({ operating })}
          />
          <LineSectionEditor
            title="Investing activities (assets bought / sold)"
            lines={state.investing}
            onChange={(investing) => patch({ investing })}
          />
          <LineSectionEditor
            title="Financing activities (loans, capital, drawings)"
            lines={state.financing}
            onChange={(financing) => patch({ financing })}
          />
        </div>
      </Card>

      <Card className="h-fit lg:sticky lg:top-24">
        <h2 className="mb-4 text-lg font-bold text-ink">Cash summary</h2>
        <div className="space-y-2 text-sm">
          <Row label="Operating" value={money(r.operating)} />
          <Row label="Investing" value={money(r.investing)} />
          <Row label="Financing" value={money(r.financing)} />
          <Row label="Net change in cash" value={money(r.netChange)} strong />
          <Row label="Opening cash" value={money(state.openingCash || 0)} />
        </div>
        <div
          className={`mt-4 rounded-xl p-4 ${r.closingCash >= 0 ? "bg-emerald-100" : "bg-red-50"}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Closing cash</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              r.closingCash >= 0 ? "text-emerald-700" : "text-red-600"
            }`}
          >
            {money(r.closingCash)}
          </p>
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
