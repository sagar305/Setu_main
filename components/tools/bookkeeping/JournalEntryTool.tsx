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
import { useLocalStore, generateLocalId } from "@/lib/hooks/useLocalStore";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { formatMoney } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import {
  COA_STORAGE_KEY,
  DEFAULT_ACCOUNTS,
  JOURNAL_STORAGE_KEY,
  accountLabel,
  type Account,
  type JournalEntry,
  type JournalLine,
} from "@/lib/bookkeeping";

const todayIso = () => new Date().toISOString().split("T")[0];

const blankLine = (): JournalLine => ({ id: generateLocalId(), accountId: "", debit: 0, credit: 0 });

export function JournalEntryTool() {
  const { code: currency } = usePreferredCurrency();
  const [accounts] = useLocalStore<Account[]>(COA_STORAGE_KEY, DEFAULT_ACCOUNTS);
  const [entries, setEntries] = useLocalStore<JournalEntry[]>(JOURNAL_STORAGE_KEY, []);

  const [date, setDate] = useState(todayIso());
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<JournalLine[]>([blankLine(), blankLine()]);
  const [deleting, setDeleting] = useState<JournalEntry | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

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
    setEntries((prev) => [
      {
        id: generateLocalId(),
        date,
        narration: narration.trim(),
        lines: validLines,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
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
          if (deleting) setEntries((prev) => prev.filter((e) => e.id !== deleting.id));
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
