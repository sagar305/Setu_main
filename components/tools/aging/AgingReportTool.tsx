"use client";

// Shared engine for the Invoice (receivables) and Accounts Payable aging
// reports. Same bucketing logic, different party/document labels and storage.

import { useMemo, useState } from "react";
import {
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  NumberInput,
  PrimaryButton,
  SecondaryButton,
  TextInput,
} from "@/components/toolkit/ui";
import { useLocalStore, generateLocalId } from "@/lib/hooks/useLocalStore";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { formatMoney } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";

export type AgingKind = "receivable" | "payable";

type AgingDoc = {
  id: string;
  party: string;
  number: string;
  dueDate: string;
  amount: number;
};

const BUCKETS = [
  { key: "current", label: "Not yet due" },
  { key: "b30", label: "1–30 days" },
  { key: "b60", label: "31–60 days" },
  { key: "b90", label: "61–90 days" },
  { key: "b90plus", label: "90+ days" },
] as const;

type BucketKey = (typeof BUCKETS)[number]["key"];

const LABELS: Record<AgingKind, { party: string; doc: string; file: string; empty: string }> = {
  receivable: {
    party: "Customer",
    doc: "Invoice",
    file: "invoice-aging.csv",
    empty:
      "Add each unpaid customer invoice with its due date — the report buckets them by how overdue they are.",
  },
  payable: {
    party: "Supplier",
    doc: "Bill",
    file: "ap-aging.csv",
    empty:
      "Add each unpaid supplier bill with its due date — the report shows which payments are most overdue.",
  },
};

function bucketOf(dueDate: string, today: string): BucketKey {
  if (dueDate >= today) return "current";
  const days = Math.floor(
    (new Date(today + "T00:00:00").getTime() - new Date(dueDate + "T00:00:00").getTime()) / 86400000
  );
  if (days <= 30) return "b30";
  if (days <= 60) return "b60";
  if (days <= 90) return "b90";
  return "b90plus";
}

const todayIso = () => new Date().toISOString().split("T")[0];

export function AgingReportTool({ kind }: { kind: AgingKind }) {
  const labels = LABELS[kind];
  const { code: currency } = usePreferredCurrency();
  const [docs, setDocs, loaded] = useLocalStore<AgingDoc[]>(`setu-aging-${kind}`, []);

  const [party, setParty] = useState("");
  const [number, setNumber] = useState("");
  const [dueDate, setDueDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [deleting, setDeleting] = useState<AgingDoc | null>(null);

  const money = (v: number) => formatMoney(v, currency);
  const amountNum = Number(amount);
  const canAdd = party.trim().length > 0 && Number.isFinite(amountNum) && amountNum > 0;

  const add = () => {
    if (!canAdd) return;
    setDocs((prev) => [
      ...prev,
      {
        id: generateLocalId(),
        party: party.trim(),
        number: number.trim(),
        dueDate,
        amount: amountNum,
      },
    ]);
    setNumber("");
    setAmount("");
  };

  const today = todayIso();

  const report = useMemo(() => {
    const totals: Record<BucketKey, number> = { current: 0, b30: 0, b60: 0, b90: 0, b90plus: 0 };
    const byParty = new Map<string, Record<BucketKey, number> & { total: number }>();
    let grand = 0;
    for (const doc of docs) {
      const bucket = bucketOf(doc.dueDate, today);
      totals[bucket] += doc.amount;
      grand += doc.amount;
      const row =
        byParty.get(doc.party) ??
        ({ current: 0, b30: 0, b60: 0, b90: 0, b90plus: 0, total: 0 } as Record<BucketKey, number> & {
          total: number;
        });
      row[bucket] += doc.amount;
      row.total += doc.amount;
      byParty.set(doc.party, row);
    }
    const rows = [...byParty.entries()].sort((a, b) => b[1].total - a[1].total);
    const overdue = grand - totals.current;
    return { totals, rows, grand, overdue };
  }, [docs, today]);

  const exportCsv = () =>
    downloadCsv(
      labels.file,
      toCsv(
        [labels.party, ...BUCKETS.map((b) => b.label), "Total"],
        [
          ...report.rows.map(([name, row]) => [
            name,
            ...BUCKETS.map((b) => (row[b.key] ? row[b.key].toFixed(2) : "")),
            row.total.toFixed(2),
          ]),
          ["TOTAL", ...BUCKETS.map((b) => report.totals[b.key].toFixed(2)), report.grand.toFixed(2)],
        ]
      )
    );

  const sortedDocs = [...docs].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <Card className="h-fit">
        <h2 className="mb-4 text-lg font-bold text-ink">Add unpaid {labels.doc.toLowerCase()}</h2>
        <div className="space-y-4">
          <Field label={`${labels.party} name *`}>
            <TextInput value={party} onChange={(e) => setParty(e.target.value)} />
          </Field>
          <Field label={`${labels.doc} number`}>
            <TextInput value={number} onChange={(e) => setNumber(e.target.value)} />
          </Field>
          <Field label="Due date">
            <TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Amount outstanding">
            <NumberInput
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <PrimaryButton className="w-full" onClick={add} disabled={!canAdd}>
            Add to report
          </PrimaryButton>
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-ink">Aging summary</h2>
            <SecondaryButton onClick={exportCsv} disabled={docs.length === 0}>
              Export CSV
            </SecondaryButton>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {BUCKETS.map((b, i) => (
              <div
                key={b.key}
                className={`rounded-xl p-3 text-center ${
                  i === 0 ? "bg-emerald-50" : i >= 3 ? "bg-red-50" : "bg-cream-paper/70"
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {b.label}
                </p>
                <p
                  className={`mt-1 text-sm font-bold ${
                    i === 0 ? "text-emerald-700" : i >= 3 ? "text-red-600" : "text-ink"
                  }`}
                >
                  {money(report.totals[b.key])}
                </p>
              </div>
            ))}
            <div className="rounded-xl bg-indigo p-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-cream-paper/70">
                Total
              </p>
              <p className="mt-1 text-sm font-bold text-cream-paper">{money(report.grand)}</p>
            </div>
          </div>

          {!loaded ? (
            <p className="py-8 text-center text-sm text-muted">Loading…</p>
          ) : report.rows.length === 0 ? (
            <EmptyState title={`No unpaid ${labels.doc.toLowerCase()}s yet`} subtitle={labels.empty} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b-2 border-indigo/30 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3">{labels.party}</th>
                    {BUCKETS.map((b) => (
                      <th key={b.key} className="py-2 pr-3 text-right">
                        {b.label}
                      </th>
                    ))}
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map(([name, row]) => (
                    <tr key={name} className="border-b border-muted-line/30">
                      <td className="py-2 pr-3 font-medium text-ink">{name}</td>
                      {BUCKETS.map((b) => (
                        <td key={b.key} className="py-2 pr-3 text-right">
                          {row[b.key] ? money(row[b.key]) : "—"}
                        </td>
                      ))}
                      <td className="py-2 text-right font-bold">{money(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report.overdue > 0 ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {money(report.overdue)} is past due
              {kind === "receivable"
                ? " — chase the 90+ bucket first; the older a debt gets, the less likely it is to be collected."
                : " — clear the oldest bills first to protect supplier relationships and credit terms."}
            </p>
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold text-ink">
            {labels.doc}s in this report ({docs.length})
          </h2>
          {sortedDocs.length === 0 ? (
            <p className="text-sm text-muted">Nothing added yet.</p>
          ) : (
            <div className="space-y-2">
              {sortedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-muted-line/30 px-4 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {doc.party}
                      {doc.number ? <span className="text-muted"> · {doc.number}</span> : null}
                    </p>
                    <p className="text-xs text-muted">
                      Due {doc.dueDate}
                      {doc.dueDate < today ? " · overdue" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-ink">{money(doc.amount)}</p>
                    <button
                      type="button"
                      onClick={() => setDeleting(doc)}
                      className="text-xs font-semibold text-red-500 hover:text-red-600"
                    >
                      {kind === "receivable" ? "Paid / remove" : "Paid / remove"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title={`Remove ${labels.doc.toLowerCase()}?`}
        message={
          deleting
            ? `Remove ${deleting.number || "this " + labels.doc.toLowerCase()} for ${deleting.party} (${money(deleting.amount)}) from the report?`
            : ""
        }
        confirmLabel="Remove"
        onConfirm={() => {
          if (deleting) setDocs((prev) => prev.filter((d) => d.id !== deleting.id));
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
