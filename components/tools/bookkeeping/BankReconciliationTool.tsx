"use client";

import { useMemo, useState } from "react";
import {
  Card,
  ConfirmDialog,
  Field,
  NumberInput,
  PrimaryButton,
  Select,
  TextInput,
} from "@/components/toolkit/ui";
import { useLocalStore, generateLocalId } from "@/lib/hooks/useLocalStore";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { formatMoney } from "@/lib/pos/types";

// Reconciling items, grouped by which balance they adjust.
type ItemKind =
  | "deposit-in-transit" // + bank side
  | "outstanding-payment" // − bank side
  | "bank-credit" // + book side (interest, direct receipts)
  | "bank-debit"; // − book side (charges, direct debits)

type ReconItem = { id: string; kind: ItemKind; description: string; amount: number };

type ReconState = {
  bankBalance: number;
  bookBalance: number;
  items: ReconItem[];
};

const KIND_OPTIONS: { value: ItemKind; label: string; hint: string }[] = [
  {
    value: "deposit-in-transit",
    label: "Deposit in transit (+ bank)",
    hint: "Recorded in your books, not yet showing in the bank",
  },
  {
    value: "outstanding-payment",
    label: "Outstanding cheque / payment (− bank)",
    hint: "Issued by you, not yet cleared by the bank",
  },
  {
    value: "bank-credit",
    label: "Bank credit not in books (+ book)",
    hint: "Interest earned, direct customer receipt",
  },
  {
    value: "bank-debit",
    label: "Bank charge not in books (− book)",
    hint: "Bank fees, direct debits you haven't recorded",
  },
];

export function BankReconciliationTool() {
  const { code: currency } = usePreferredCurrency();
  const [state, setState, loaded] = useLocalStore<ReconState>("setu-bank-recon", {
    bankBalance: 0,
    bookBalance: 0,
    items: [],
  });

  const [kind, setKind] = useState<ItemKind>("deposit-in-transit");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [deleting, setDeleting] = useState<ReconItem | null>(null);

  const amountNum = Number(amount);
  const canAdd = Number.isFinite(amountNum) && amountNum > 0;

  const addItem = () => {
    if (!canAdd) return;
    setState((s) => ({
      ...s,
      items: [
        ...s.items,
        { id: generateLocalId(), kind, description: description.trim(), amount: amountNum },
      ],
    }));
    setDescription("");
    setAmount("");
  };

  const result = useMemo(() => {
    let adjustedBank = state.bankBalance;
    let adjustedBook = state.bookBalance;
    for (const item of state.items) {
      if (item.kind === "deposit-in-transit") adjustedBank += item.amount;
      if (item.kind === "outstanding-payment") adjustedBank -= item.amount;
      if (item.kind === "bank-credit") adjustedBook += item.amount;
      if (item.kind === "bank-debit") adjustedBook -= item.amount;
    }
    const difference = adjustedBank - adjustedBook;
    return { adjustedBank, adjustedBook, difference, reconciled: Math.abs(difference) < 0.005 };
  }, [state]);

  const kindLabel = (k: ItemKind) => KIND_OPTIONS.find((o) => o.value === k)?.label ?? k;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 text-lg font-bold text-ink">Balances</h2>
          <div className="space-y-4">
            <Field label="Bank statement closing balance">
              <NumberInput
                step="0.01"
                value={state.bankBalance || ""}
                onChange={(e) =>
                  setState((s) => ({ ...s, bankBalance: Number(e.target.value) || 0 }))
                }
                placeholder="From the bank statement"
              />
            </Field>
            <Field label="Cash book / ledger balance">
              <NumberInput
                step="0.01"
                value={state.bookBalance || ""}
                onChange={(e) =>
                  setState((s) => ({ ...s, bookBalance: Number(e.target.value) || 0 }))
                }
                placeholder="From your books"
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold text-ink">Add reconciling item</h2>
          <div className="space-y-4">
            <Field label="Type">
              <Select value={kind} onChange={(e) => setKind(e.target.value as ItemKind)}>
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-xs text-muted">{KIND_OPTIONS.find((o) => o.value === kind)?.hint}</p>
            <Field label="Description">
              <TextInput
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Cheque #104 to supplier"
              />
            </Field>
            <Field label="Amount">
              <NumberInput
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <PrimaryButton className="w-full" onClick={addItem} disabled={!canAdd}>
              Add item
            </PrimaryButton>
          </div>
        </Card>
      </div>

      <Card className="h-fit">
        <h2 className="mb-4 text-lg font-bold text-ink">Reconciliation</h2>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-cream-paper/70 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Adjusted bank</p>
            <p className="mt-1 text-lg font-bold text-ink">
              {formatMoney(result.adjustedBank, currency)}
            </p>
          </div>
          <div className="rounded-xl bg-cream-paper/70 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Adjusted book</p>
            <p className="mt-1 text-lg font-bold text-ink">
              {formatMoney(result.adjustedBook, currency)}
            </p>
          </div>
          <div
            className={`rounded-xl p-4 text-center ${
              result.reconciled ? "bg-emerald-100" : "bg-red-50"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {result.reconciled ? "Reconciled" : "Difference"}
            </p>
            <p
              className={`mt-1 text-lg font-bold ${
                result.reconciled ? "text-emerald-700" : "text-red-600"
              }`}
            >
              {result.reconciled ? "✓" : formatMoney(result.difference, currency)}
            </p>
          </div>
        </div>

        {!loaded ? (
          <p className="py-8 text-center text-sm text-muted">Loading…</p>
        ) : state.items.length === 0 ? (
          <p className="rounded-xl bg-cream-paper/50 p-4 text-sm text-muted">
            Enter both balances, then add each item that explains the gap — uncleared cheques,
            deposits in transit, bank charges and interest. When the two adjusted balances match,
            you&apos;re reconciled.
          </p>
        ) : (
          <div className="space-y-2">
            {state.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-muted-line/30 px-4 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{item.description || "—"}</p>
                  <p className="text-xs text-muted">{kindLabel(item.kind)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-bold text-ink">{formatMoney(item.amount, currency)}</p>
                  <button
                    type="button"
                    onClick={() => setDeleting(item)}
                    className="text-xs font-semibold text-red-500 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!result.reconciled && state.items.length > 0 ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Still {formatMoney(Math.abs(result.difference), currency)} apart. Common culprits:
            transposed digits, a missed bank charge, or a payment recorded twice.
          </p>
        ) : null}
      </Card>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete item?"
        message={deleting ? `Remove "${deleting.description || kindLabel(deleting.kind)}"?` : ""}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleting)
            setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== deleting.id) }));
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
