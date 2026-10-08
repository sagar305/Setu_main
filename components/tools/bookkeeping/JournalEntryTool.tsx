"use client";

import { useMemo, useState } from "react";
import {
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  NumberInput,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextInput,
} from "@/components/toolkit/ui";
import { useEntityList } from "@/lib/hooks/useEntityList";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { formatMoney, generateId } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import {
  defaultAccounts,
  accountLabel,
  type Account,
  type JournalEntry,
  type JournalLine,
} from "@/lib/bookkeeping";
import {
  journalScenarios,
  scenarioCategoryLabel,
  SCENARIO_CATEGORIES,
  type JournalScenario,
  type ScenarioCategory,
} from "@/lib/journalScenarios";

const todayIso = () => new Date().toISOString().split("T")[0];

const blankLine = (): JournalLine => ({ id: generateId(), accountId: "", debit: 0, credit: 0 });

export function JournalEntryTool() {
  const { code: currency } = usePreferredCurrency();
  const { t, lang } = useI18n();
  // Same shared stores as the Chart of Accounts and Trial Balance tools.
  const { items: coaAccounts } = useEntityList<Account>("coa_accounts");
  const accounts = coaAccounts.length > 0 ? coaAccounts : defaultAccounts(lang);
  const { items: entries, save: saveEntry, remove: removeEntry } =
    useEntityList<JournalEntry>("journal_entries");

  const [date, setDate] = useState(todayIso());
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<JournalLine[]>([blankLine(), blankLine()]);
  const [deleting, setDeleting] = useState<JournalEntry | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  // Scenario library — pick a real-world transaction and the correct
  // debit/credit lines load, ready to edit.
  const [scenarioSearch, setScenarioSearch] = useState("");
  const [scenarioCategory, setScenarioCategory] = useState<ScenarioCategory | "">("");
  const [loadedScenario, setLoadedScenario] = useState<JournalScenario | null>(null);

  // Worded for this reader; the entries themselves are the same either way.
  const scenarios = useMemo(() => journalScenarios(lang), [lang]);

  const filteredScenarios = useMemo(() => {
    const q = scenarioSearch.trim().toLowerCase();
    return scenarios.filter(
      (s) =>
        (!scenarioCategory || s.category === scenarioCategory) &&
        (!q || s.name.toLowerCase().includes(q) || s.narration.toLowerCase().includes(q))
    );
  }, [scenarios, scenarioSearch, scenarioCategory]);

  const loadScenario = (s: JournalScenario) => {
    const available = new Set(accounts.map((a) => a.id));
    setNarration(s.narration);
    setLines(
      s.lines.map((l) => ({
        id: generateId(),
        // If the user's chart no longer has this account, leave it unpicked.
        accountId: available.has(l.accountId) ? l.accountId : "",
        debit: l.side === "debit" ? l.amount : 0,
        credit: l.side === "credit" ? l.amount : 0,
      }))
    );
    setLoadedScenario(s);
    setSavedMsg(false);
  };

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [accounts]
  );

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const line of lines) {
      debit += line.debit || 0;
      credit += line.credit || 0;
    }
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.005 && debit > 0 };
  }, [lines]);

  const validLines = lines.filter((l) => l.accountId && (l.debit > 0 || l.credit > 0));
  const canPost = totals.balanced && validLines.length >= 2 && narration.trim().length > 0;

  const updateLine = (id: string, patch: Partial<JournalLine>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const post = () => {
    if (!canPost) return;
    void saveEntry({
      id: generateId(),
      date,
      narration: narration.trim(),
      lines: validLines,
      createdAt: new Date().toISOString(),
    });
    setNarration("");
    setLines([blankLine(), blankLine()]);
    setSavedMsg(true);
  };

  const exportCsv = () => {
    const rows: unknown[][] = [];
    const sorted = [...entries].sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
    );
    for (const entry of sorted) {
      for (const line of entry.lines) {
        rows.push([
          entry.date,
          entry.narration,
          accountLabel(accounts, line.accountId, lang),
          line.debit ? line.debit.toFixed(2) : "",
          line.credit ? line.credit.toFixed(2) : "",
        ]);
      }
    }
    downloadCsv("journal.csv", toCsv(["Date", "Narration", "Account", "Debit", "Credit"], rows));
  };

  const recent = [...entries]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 15);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
      <Card>
        <h2 className="mb-1 text-lg font-bold text-ink">{t("jeScenarioLibrary")}</h2>
        <p className="mb-3 text-sm text-muted">{t("jeScenarioIntro")}</p>
        <TextInput
          value={scenarioSearch}
          onChange={(e) => setScenarioSearch(e.target.value)}
          placeholder={t("jeSearchScenarios")}
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setScenarioCategory("")}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              scenarioCategory === ""
                ? "border-indigo bg-indigo text-cream-paper"
                : "border-muted-line/40 text-ink/70 hover:border-indigo/40"
            }`}
          >
            {fill(t("jeAllCount"), { count: scenarios.length })}
          </button>
          {SCENARIO_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setScenarioCategory(scenarioCategory === c ? "" : c)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                scenarioCategory === c
                  ? "border-indigo bg-indigo text-cream-paper"
                  : "border-muted-line/40 text-ink/70 hover:border-indigo/40"
              }`}
            >
              {scenarioCategoryLabel(c, lang)}
            </button>
          ))}
        </div>
        <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
          {filteredScenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => loadScenario(s)}
              className={`rounded-lg border p-2.5 text-left transition ${
                loadedScenario?.id === s.id
                  ? "border-indigo/50 bg-indigo/5"
                  : "border-muted-line/30 hover:border-indigo/40"
              }`}
            >
              <p className="text-sm font-semibold text-ink">{s.name}</p>
              <p className="text-xs text-muted">{scenarioCategoryLabel(s.category, lang)}</p>
            </button>
          ))}
          {filteredScenarios.length === 0 ? (
            <p className="py-4 text-sm text-muted">{t("jeNoScenarios")}</p>
          ) : null}
        </div>
        {loadedScenario ? (
          <div className="mt-3 space-y-2 rounded-xl bg-cream-paper/60 p-4 text-sm">
            <p>
              <span className="font-semibold text-ink">{t("jeWhyThisEntry")} </span>
              <span className="text-muted">{loadedScenario.explanation}</span>
            </p>
            <p>
              <span className="font-semibold text-red-600">{t("jeCommonMistake")} </span>
              <span className="text-muted">{loadedScenario.mistake}</span>
            </p>
          </div>
        ) : null}
      </Card>

      <Card className="h-fit">
        <h2 className="mb-4 text-lg font-bold text-ink">{t("jeNewEntry")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("date")}>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t("jeNarrationReq")}>
            <TextInput
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder={t("jeNarrationPlaceholder")}
            />
          </Field>
        </div>

        <h3 className="mb-2 mt-5 text-sm font-bold text-ink">{t("jeLines")}</h3>
        <div className="space-y-2">
          {lines.map((line) => (
            <div
              key={line.id}
              className="grid grid-cols-2 items-end gap-2 rounded-lg border border-muted-line/30 p-3 sm:grid-cols-[1fr_120px_120px_auto]"
            >
              <Field label={t("bkAccount")}>
                <Select
                  value={line.accountId}
                  onChange={(e) => updateLine(line.id, { accountId: e.target.value })}
                >
                  <option value="">{t("jeChooseAccount")}</option>
                  {sortedAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("bkDebit")}>
                <NumberInput
                  min={0}
                  step="0.01"
                  value={line.debit || ""}
                  onChange={(e) =>
                    updateLine(line.id, { debit: Number(e.target.value) || 0, credit: 0 })
                  }
                />
              </Field>
              <Field label={t("bkCredit")}>
                <NumberInput
                  min={0}
                  step="0.01"
                  value={line.credit || ""}
                  onChange={(e) =>
                    updateLine(line.id, { credit: Number(e.target.value) || 0, debit: 0 })
                  }
                />
              </Field>
              <button
                type="button"
                onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
                disabled={lines.length <= 2}
                className="mb-1 justify-self-end text-sm font-semibold text-red-500 hover:text-red-600 disabled:opacity-40"
              >
                {t("remove")}
              </button>
            </div>
          ))}
        </div>
        <SecondaryButton className="mt-3" onClick={() => setLines((p) => [...p, blankLine()])}>
          {t("jeAddLine")}
        </SecondaryButton>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-muted-line/30 pt-4">
          <p className="text-sm">
            <span className="font-semibold text-ink">
              {t("bkDr")} {formatMoney(totals.debit, currency)}
            </span>
            <span className="mx-2 text-muted">·</span>
            <span className="font-semibold text-ink">
              {t("bkCr")} {formatMoney(totals.credit, currency)}
            </span>
            <span
              className={`ml-3 rounded-full px-2.5 py-1 text-xs font-semibold ${
                totals.balanced ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
              }`}
            >
              {t(totals.balanced ? "tbBalanced" : "jeNotBalanced")}
            </span>
          </p>
          <PrimaryButton onClick={post} disabled={!canPost}>
            {t("jePostEntry")}
          </PrimaryButton>
        </div>
        {savedMsg ? (
          <p className="mt-2 text-sm font-medium text-emerald-600">{t("jeEntryPosted")} ✓</p>
        ) : null}
      </Card>
      </div>

      <Card className="h-fit">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">{t("jeRecentEntries")}</h2>
          <SecondaryButton onClick={exportCsv} disabled={entries.length === 0}>
            {t("exportCsv")}
          </SecondaryButton>
        </div>
        {recent.length === 0 ? (
          <EmptyState title={t("noEntries")} subtitle={t("jeNoEntriesSub")} />
        ) : (
          <div className="space-y-3">
            {recent.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-muted-line/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">{entry.narration}</p>
                    <p className="text-xs text-muted">{entry.date}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleting(entry)}
                    className="text-xs font-semibold text-red-500 hover:text-red-600"
                  >
                    {t("delete")}
                  </button>
                </div>
                <div className="mt-2 space-y-0.5 text-xs text-muted">
                  {entry.lines.map((line) => (
                    <p key={line.id}>
                      {t(line.debit > 0 ? "bkDr" : "bkCr")}{" "}
                      {accountLabel(accounts, line.accountId, lang)} —{" "}
                      {formatMoney(line.debit || line.credit, currency)}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={deleting !== null}
        title={t("jeDeleteEntry")}
        message={
          deleting
            ? fill(t("jeDeleteEntryMsg"), {
                narration: deleting.narration,
                date: deleting.date,
              })
            : ""
        }
        confirmLabel={t("delete")}
        onConfirm={() => {
          if (deleting) void removeEntry(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
