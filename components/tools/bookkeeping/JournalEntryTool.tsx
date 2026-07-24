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
import { formatMoney, generateId } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import {
  DEFAULT_ACCOUNTS,
  accountLabel,
  type Account,
  type JournalEntry,
  type JournalLine,
} from "@/lib/bookkeeping";
import {
  JOURNAL_SCENARIOS,
  SCENARIO_CATEGORIES,
  type JournalScenario,
} from "@/lib/journalScenarios";

const todayIso = () => new Date().toISOString().split("T")[0];

const blankLine = (): JournalLine => ({ id: generateId(), accountId: "", debit: 0, credit: 0 });

export function JournalEntryTool() {
  const { code: currency } = usePreferredCurrency();
  // Same shared stores as the Chart of Accounts and Trial Balance tools.
  const { items: coaAccounts } = useEntityList<Account>("coa_accounts");
  const accounts = coaAccounts.length > 0 ? coaAccounts : DEFAULT_ACCOUNTS;
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
  const [scenarioCategory, setScenarioCategory] = useState("");
  const [loadedScenario, setLoadedScenario] = useState<JournalScenario | null>(null);

  const filteredScenarios = useMemo(() => {
    const q = scenarioSearch.trim().toLowerCase();
    return JOURNAL_SCENARIOS.filter(
      (s) =>
        (!scenarioCategory || s.category === scenarioCategory) &&
        (!q || s.name.toLowerCase().includes(q) || s.narration.toLowerCase().includes(q))
    );
  }, [scenarioSearch, scenarioCategory]);

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
          accountLabel(accounts, line.accountId),
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
        <h2 className="mb-1 text-lg font-bold text-ink">Scenario library</h2>
        <p className="mb-3 text-sm text-muted">
          Not sure which account to debit or credit? Pick the transaction — the correct entry loads
          below, ready to edit.
        </p>
        <TextInput
          value={scenarioSearch}
          onChange={(e) => setScenarioSearch(e.target.value)}
          placeholder="Search scenarios… (e.g. depreciation, GST, salary, loan)"
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
            All ({JOURNAL_SCENARIOS.length})
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
              {c}
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
              <p className="text-xs text-muted">{s.category}</p>
            </button>
          ))}
          {filteredScenarios.length === 0 ? (
            <p className="py-4 text-sm text-muted">No scenarios match that search.</p>
          ) : null}
        </div>
        {loadedScenario ? (
          <div className="mt-3 space-y-2 rounded-xl bg-cream-paper/60 p-4 text-sm">
            <p>
              <span className="font-semibold text-ink">Why this entry: </span>
              <span className="text-muted">{loadedScenario.explanation}</span>
            </p>
            <p>
              <span className="font-semibold text-red-600">Common mistake: </span>
              <span className="text-muted">{loadedScenario.mistake}</span>
            </p>
          </div>
        ) : null}
      </Card>

      <Card className="h-fit">
        <h2 className="mb-4 text-lg font-bold text-ink">New journal entry</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Narration *">
            <TextInput
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="e.g. Paid shop rent for July by bank transfer"
            />
          </Field>
        </div>

        <h3 className="mb-2 mt-5 text-sm font-bold text-ink">Lines (debits must equal credits)</h3>
        <div className="space-y-2">
          {lines.map((line) => (
            <div
              key={line.id}
              className="grid grid-cols-2 items-end gap-2 rounded-lg border border-muted-line/30 p-3 sm:grid-cols-[1fr_120px_120px_auto]"
            >
              <Field label="Account">
                <Select
                  value={line.accountId}
                  onChange={(e) => updateLine(line.id, { accountId: e.target.value })}
                >
                  <option value="">Choose account…</option>
                  {sortedAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Debit">
                <NumberInput
                  min={0}
                  step="0.01"
                  value={line.debit || ""}
                  onChange={(e) =>
                    updateLine(line.id, { debit: Number(e.target.value) || 0, credit: 0 })
                  }
                />
              </Field>
              <Field label="Credit">
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
                Remove
              </button>
            </div>
          ))}
        </div>
        <SecondaryButton className="mt-3" onClick={() => setLines((p) => [...p, blankLine()])}>
          + Add line
        </SecondaryButton>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-muted-line/30 pt-4">
          <p className="text-sm">
            <span className="font-semibold text-ink">Dr {formatMoney(totals.debit, currency)}</span>
            <span className="mx-2 text-muted">·</span>
            <span className="font-semibold text-ink">Cr {formatMoney(totals.credit, currency)}</span>
            <span
              className={`ml-3 rounded-full px-2.5 py-1 text-xs font-semibold ${
                totals.balanced ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
              }`}
            >
              {totals.balanced ? "Balanced" : "Not balanced"}
            </span>
          </p>
          <PrimaryButton onClick={post} disabled={!canPost}>
            Post entry
          </PrimaryButton>
        </div>
        {savedMsg ? <p className="mt-2 text-sm font-medium text-emerald-600">Entry posted ✓</p> : null}
      </Card>
      </div>

      <Card className="h-fit">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Recent entries</h2>
          <SecondaryButton onClick={exportCsv} disabled={entries.length === 0}>
            Export CSV
          </SecondaryButton>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            title="No entries yet"
            subtitle="Posted entries appear here and flow into the General Ledger and Trial Balance tools automatically."
          />
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
                    Delete
                  </button>
                </div>
                <div className="mt-2 space-y-0.5 text-xs text-muted">
                  {entry.lines.map((line) => (
                    <p key={line.id}>
                      {line.debit > 0 ? "Dr" : "Cr"} {accountLabel(accounts, line.accountId)} —{" "}
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
        title="Delete journal entry?"
        message={
          deleting
            ? `Delete "${deleting.narration}" (${deleting.date})? The ledger and trial balance will update.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleting) void removeEntry(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
