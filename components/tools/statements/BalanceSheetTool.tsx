"use client";

import { useMemo, useState } from "react";
import { Card, Field, SecondaryButton, TextInput } from "@/components/toolkit/ui";
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useLocalStore } from "@/lib/hooks/useLocalStore";
import { useFinanceWorkspace } from "@/lib/hooks/useFinanceWorkspace";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";
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

type BsState = {
  businessName: string;
  asOf: string;
  currentAssets: StatementLine[];
  fixedAssets: StatementLine[];
  currentLiabilities: StatementLine[];
  longTermLiabilities: StatementLine[];
  equity: StatementLine[];
};

// The starting line labels are the user's to edit, so they begin in the
// user's own language rather than making them translate the form away.
const initialState = (lang: LanguageCode): BsState => {
  const seed = (key: TKey) => blankLine(translate(lang, key));
  return {
    businessName: "",
    asOf: "",
    currentAssets: [seed("stSeedCashBank"), seed("stSeedReceivable"), seed("stSeedInventory")],
    fixedAssets: [seed("stSeedEquipment")],
    currentLiabilities: [seed("stSeedPayable"), seed("stSeedGstPayable")],
    longTermLiabilities: [seed("stSeedLoans")],
    equity: [seed("stSeedCapital"), seed("stSeedRetained")],
  };
};

export function BalanceSheetTool() {
  const { code: currency } = usePreferredCurrency();
  const workspace = useFinanceWorkspace("balance-sheet");
  const { t, lang } = useI18n();
  const [initial] = useState(() => initialState(lang));
  const [state, setState] = useLocalStore<BsState>("setu-stmt-bs", initial);
  const money = (v: number) => formatMoney(v, currency);
  const patch = (p: Partial<BsState>) => setState((s) => ({ ...s, ...p }));

  // Fill the figures we can derive: cash from the cash book's net position,
  // receivables from customers who still owe on their ledger.
  const pullFromWorkspace = () => {
    const cashLabel = t("stSeedCashBank");
    const receivableLabel = t("stSeedReceivable");
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
        { id: generateId(), label: cashLabel, amount: cash },
        { id: generateId(), label: receivableLabel, amount: receivables },
        // Matched against the labels this tool seeded, which are in the
        // reader's language, so the pull replaces its own rows rather than
        // stacking a second copy on top of them.
        ...s.currentAssets.filter((l) => l.label !== cashLabel && l.label !== receivableLabel),
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
    const workingCapital = currentAssets - currentLiabilities;
    return {
      workingCapital,
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
      { label: t("stAssetsCurrent"), value: "", kind: "heading" },
      ...section(state.currentAssets),
      { label: t("stTotalCurrentAssets"), value: money(r.currentAssets), kind: "subtotal" },
      { label: t("stAssetsFixed"), value: "", kind: "heading" },
      ...section(state.fixedAssets),
      { label: t("stTotalFixedAssets"), value: money(r.fixedAssets), kind: "subtotal" },
      { label: t("stTotalAssets"), value: money(r.totalAssets), kind: "total" },
      { label: t("stLiabilitiesCurrent"), value: "", kind: "heading" },
      ...section(state.currentLiabilities),
      { label: t("stTotalCurrentLiabilities"), value: money(r.currentLiabilities), kind: "subtotal" },
      { label: t("stLiabilitiesLongTerm"), value: "", kind: "heading" },
      ...section(state.longTermLiabilities),
      { label: t("stTotalLiabilities"), value: money(r.totalLiabilities), kind: "subtotal" },
      { label: t("stEquity"), value: "", kind: "heading" },
      ...section(state.equity),
      { label: t("stTotalEquity"), value: money(r.equity), kind: "subtotal" },
      { label: t("stTotalLiabEquity"), value: money(r.totalLiabEquity), kind: "total" },
    ];
    printStatement({
      docTitle: t("stBsTitle"),
      businessName: state.businessName,
      periodLabel: state.asOf ? fill(t("stAsOf"), { date: state.asOf }) : t("stAsOfDate"),
      rows,
      lang,
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
        message={t("stBsWorkspaceMsg")}
      />

      <div className="grid gap-6 lg:grid-cols-2">
      <Card className="h-fit">
        {workspace.connected ? (
          <div className="mb-4">
            <SecondaryButton onClick={pullFromWorkspace}>
              ↻ {t("stBsPullBtn")}
            </SecondaryButton>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("spBusinessName")}>
            <TextInput
              value={state.businessName}
              onChange={(e) => patch({ businessName: e.target.value })}
            />
          </Field>
          <Field label={t("stAsOfDate")}>
            <TextInput type="date" value={state.asOf} onChange={(e) => patch({ asOf: e.target.value })} />
          </Field>
        </div>
        <div className="mt-6 space-y-6">
          <LineSectionEditor
            title={t("stCurrentAssets")}
            lines={state.currentAssets}
            onChange={(currentAssets) => patch({ currentAssets })}
          />
          <LineSectionEditor
            title={t("stFixedAssetsSection")}
            lines={state.fixedAssets}
            onChange={(fixedAssets) => patch({ fixedAssets })}
          />
          <LineSectionEditor
            title={t("stCurrentLiabilities")}
            lines={state.currentLiabilities}
            onChange={(currentLiabilities) => patch({ currentLiabilities })}
          />
          <LineSectionEditor
            title={t("stLongTermLiabilities")}
            lines={state.longTermLiabilities}
            onChange={(longTermLiabilities) => patch({ longTermLiabilities })}
          />
          <LineSectionEditor
            title={t("stEquity")}
            lines={state.equity}
            onChange={(equity) => patch({ equity })}
          />
        </div>
      </Card>

      <Card className="h-fit lg:sticky lg:top-24">
        <h2 className="mb-4 text-lg font-bold text-ink">{t("stBalanceCheck")}</h2>
        <div className="space-y-2 text-sm">
          <Row label={t("stCurrentAssets")} value={money(r.currentAssets)} />
          <Row label={t("stFixedAssets")} value={money(r.fixedAssets)} />
          <Row label={t("stTotalAssets")} value={money(r.totalAssets)} strong />
          <Row label={t("stCurrentLiabilities")} value={money(r.currentLiabilities)} />
          <Row label={t("stLongTermLiabilities")} value={money(r.longTermLiabilities)} />
          <Row label={t("stTotalEquity")} value={money(r.equity)} />
          <Row label={t("stLiabPlusEquity")} value={money(r.totalLiabEquity)} strong />
          <div className="flex justify-between pt-1 text-muted">
            <span>{t("stWorkingCapital")}</span>
            <span className={r.workingCapital >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
              {money(r.workingCapital)}
            </span>
          </div>
        </div>

        <div
          className={`mt-4 rounded-xl p-4 ${r.balanced ? "bg-emerald-100" : "bg-red-50"}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t(r.balanced ? "tbBalanced" : "stOutOfBalance")}
          </p>
          <p
            className={`mt-1 text-xl font-bold ${r.balanced ? "text-emerald-700" : "text-red-600"}`}
          >
            {r.balanced
              ? `${t("stBalancedEq")} ✓`
              : fill(t("stDifference"), { amount: money(r.difference) })}
          </p>
          {!r.balanced ? (
            <p className="mt-1 text-xs text-muted">{t("stBalanceHint")}</p>
          ) : null}
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
