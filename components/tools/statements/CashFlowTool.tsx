"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Field, NumberInput, SecondaryButton, TextInput } from "@/components/toolkit/ui";
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useLocalStore } from "@/lib/hooks/useLocalStore";
import { useFinanceWorkspace } from "@/lib/hooks/useFinanceWorkspace";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";
import { relabelSeedLines } from "@/lib/i18n/seed-labels";
import { translate, type TKey } from "@/lib/i18n/translate";
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

// Amounts are signed: inflows positive, outflows negative.
type CfState = {
  businessName: string;
  period: string;
  openingCash: number;
  operating: StatementLine[];
  investing: StatementLine[];
  financing: StatementLine[];
};

// The starting line labels are the user's to edit, so they begin in the
// user's own language rather than making them translate the form away.
const SEED_KEYS: TKey[] = [
  "stSeedCashFromCustomers",
  "stSeedPaidToSuppliers",
  "stSeedEquipmentPurchased",
  "stSeedLoanReceivedRepaid",
  "stSeedCashReceivedBook",
  "stSeedCashPaidBook",
];

const SEEDED_FIELDS = [
  "operating",
  "investing",
  "financing",
] as const satisfies readonly (keyof CfState)[];

const initialState = (lang: LanguageCode): CfState => {
  const seed = (key: TKey) => blankLine(translate(lang, key));
  return {
    businessName: "",
    period: "",
    openingCash: 0,
    operating: [seed("stSeedCashFromCustomers"), seed("stSeedPaidToSuppliers")],
    investing: [seed("stSeedEquipmentPurchased")],
    financing: [seed("stSeedLoanReceivedRepaid")],
  };
};

export function CashFlowTool() {
  const { code: currency } = usePreferredCurrency();
  const workspace = useFinanceWorkspace("cash-flow-statement");
  const { t, lang } = useI18n();
  const [initial] = useState(() => initialState(lang));
  const [state, setState, loaded] = useLocalStore<CfState>("setu-stmt-cf", initial);

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
        { id: generateId(), label: t("stSeedCashReceivedBook"), amount: cashIn },
        { id: generateId(), label: t("stSeedCashPaidBook"), amount: -cashOut },
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
      { label: t("stOperatingActivities"), value: "", kind: "heading" },
      ...section(state.operating),
      { label: t("stNetCashOperations"), value: money(r.operating), kind: "subtotal" },
      { label: t("stInvestingActivities"), value: "", kind: "heading" },
      ...section(state.investing),
      { label: t("stNetCashInvesting"), value: money(r.investing), kind: "subtotal" },
      { label: t("stFinancingActivities"), value: "", kind: "heading" },
      ...section(state.financing),
      { label: t("stNetCashFinancing"), value: money(r.financing), kind: "subtotal" },
      { label: t("stNetChangeCash"), value: money(r.netChange), kind: "subtotal" },
      { label: t("stOpeningCash"), value: money(state.openingCash || 0) },
      { label: t("stClosingCash"), value: money(r.closingCash), kind: "total" },
    ];
    printStatement({
      docTitle: t("stCfTitle"),
      businessName: state.businessName,
      periodLabel: state.period || t("stForThePeriod"),
      rows,
      footNote: t("stCfFootnote"),
      lang,
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
        message={t("stCfWorkspaceMsg")}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card className="h-fit">
        <div className="grid gap-4 sm:grid-cols-3">
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
              placeholder={t("stCfPeriodPlaceholder")}
            />
          </Field>
          <Field label={t("stOpeningCashBalance")}>
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
              ↻ {t("stCfPullBtn")}
            </SecondaryButton>
          </div>
        ) : null}

        <p className="mt-4 rounded-xl bg-cream-paper/50 px-4 py-3 text-xs text-muted">
          {t("stCfSignHint")}
        </p>

        <div className="mt-6 space-y-6">
          <LineSectionEditor
            title={t("stOperatingSection")}
            lines={state.operating}
            onChange={(operating) => patch({ operating })}
          />
          <LineSectionEditor
            title={t("stInvestingSection")}
            lines={state.investing}
            onChange={(investing) => patch({ investing })}
          />
          <LineSectionEditor
            title={t("stFinancingSection")}
            lines={state.financing}
            onChange={(financing) => patch({ financing })}
          />
        </div>
      </Card>

      <Card className="h-fit lg:sticky lg:top-24">
        <h2 className="mb-4 text-lg font-bold text-ink">{t("stCashSummary")}</h2>
        <div className="space-y-2 text-sm">
          <Row label={t("stOperating")} value={money(r.operating)} />
          <Row label={t("stInvesting")} value={money(r.investing)} />
          <Row label={t("stFinancing")} value={money(r.financing)} />
          <Row label={t("stNetChangeCash")} value={money(r.netChange)} strong />
          <Row label={t("stOpeningCash")} value={money(state.openingCash || 0)} />
        </div>
        <div
          className={`mt-4 rounded-xl p-4 ${r.closingCash >= 0 ? "bg-emerald-100" : "bg-red-50"}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("stClosingCash")}
          </p>
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
