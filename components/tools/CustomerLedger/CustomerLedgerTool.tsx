"use client";

// Customer Ledger (Udhaar) — tracks credit given and payments received per
// customer. Customers are the SHARED workspace entity (one customer book for
// POS, Invoice and Ledger); ledger entries are owned by this tool.

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
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useWorkspaceConnection } from "@/lib/hooks/useWorkspaceConnection";
import { useEntityList } from "@/lib/hooks/useEntityList";
import { putRecord } from "@/lib/toolkit/workspace";
import type { LedgerEntry } from "@/lib/toolkit/types";
import type { Customer } from "@/lib/pos/types";
import { currencySymbol, formatMoney, generateId, nowIso } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";

const todayIso = () => new Date().toISOString().split("T")[0];

export function CustomerLedgerTool() {
  const workspace = useWorkspaceConnection("customer-ledger");
  const { items: entries, save, remove } = useEntityList<LedgerEntry>("ledger");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [type, setType] = useState<"credit" | "payment">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayIso());
  const [deleting, setDeleting] = useState<LedgerEntry | null>(null);

  const currency = workspace.business?.currency ?? "INR";

  const balances = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      const signed = e.type === "credit" ? e.amount : -e.amount;
      map.set(e.customerId, (map.get(e.customerId) ?? 0) + signed);
    }
    return map;
  }, [entries]);

  const totalOutstanding = useMemo(
    () => Array.from(balances.values()).reduce((s, b) => s + Math.max(0, b), 0),
    [balances]
  );

  const customers = useMemo(
    () =>
      [...workspace.customers].sort(
        (a, b) => (balances.get(b.id) ?? 0) - (balances.get(a.id) ?? 0)
      ),
    [workspace.customers, balances]
  );

  const selected = customers.find((c) => c.id === selectedId) ?? null;
  const selectedEntries = useMemo(
    () =>
      entries
        .filter((e) => e.customerId === selectedId)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [entries, selectedId]
  );

  const addCustomer = async () => {
    if (!newName.trim()) return;
    // Writing a NEW customer into the shared workspace book (plain update —
    // POS and Invoice will see them too).
    const customer: Customer = {
      id: generateId(),
      name: newName.trim(),
      phone: newPhone.trim(),
      email: "",
      address: "",
      notes: "",
      createdAt: nowIso(),
    };
    await putRecord("customers", customer);
    await workspace.reload();
    setSelectedId(customer.id);
    setNewName("");
    setNewPhone("");
  };

  const amountNum = Number(amount);
  const canAdd = selected && Number.isFinite(amountNum) && amountNum > 0;

  const addEntry = async () => {
    if (!selected || !canAdd) return;
    await save({
      id: generateId(),
      customerId: selected.id,
      customerName: selected.name,
      type,
      amount: amountNum,
      note: note.trim(),
      date,
      createdByTool: "customer-ledger",
      createdAt: nowIso(),
    });
    setAmount("");
    setNote("");
  };

  const exportCsv = () =>
    downloadCsv(
      "customer-ledger.csv",
      toCsv(
        ["Date", "Customer", "Type", "Amount", "Note"],
        [...entries]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((e) => [
            e.date,
            e.customerName,
            e.type === "credit" ? "Credit given" : "Payment received",
            e.amount.toFixed(2),
            e.note,
          ])
      )
    );

  return (
    <div>
      <WorkspaceBanner
        connection={workspace}
        message="Track udhaar for the same customers your POS and invoices use — one customer book everywhere."
      />

      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl bg-cream-paper/70 px-5 py-4">
        <p className="text-sm text-muted">
          Total outstanding:{" "}
          <span className="text-lg font-bold text-ink">
            {formatMoney(totalOutstanding, currency)}
          </span>
        </p>
        <SecondaryButton onClick={exportCsv} disabled={entries.length === 0}>
          Export CSV
        </SecondaryButton>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit">
          <h2 className="mb-4 text-lg font-bold text-ink">Customers</h2>

          <div className="mb-4 space-y-2 rounded-lg border border-muted-line/30 p-3">
            <TextInput
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New customer name"
            />
            <TextInput
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Phone (optional)"
            />
            <PrimaryButton className="w-full" onClick={addCustomer} disabled={!newName.trim()}>
              Add customer
            </PrimaryButton>
          </div>

          {customers.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">
              {workspace.exists && !workspace.connected
                ? "Connect your workspace above to see saved customers."
                : "No customers yet — add your first one above."}
            </p>
          ) : (
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {customers.map((c) => {
                const balance = balances.get(c.id) ?? 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition ${
                      selectedId === c.id ? "bg-indigo/10" : "hover:bg-cream-paper"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-semibold text-ink">{c.name}</span>
                      {c.phone ? <span className="text-xs text-muted">{c.phone}</span> : null}
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        balance > 0 ? "text-red-600" : balance < 0 ? "text-emerald-600" : "text-muted"
                      }`}
                    >
                      {balance === 0 ? "settled" : formatMoney(Math.abs(balance), currency)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="h-fit">
          {!selected ? (
            <EmptyState
              title="Pick a customer"
              subtitle="Select a customer to see their ledger — credit given, payments received and the running balance."
            />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-ink">{selected.name}</h2>
                  <p className="text-sm text-muted">
                    Balance:{" "}
                    <span
                      className={`font-bold ${
                        (balances.get(selected.id) ?? 0) > 0 ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {formatMoney(Math.abs(balances.get(selected.id) ?? 0), currency)}
                      {(balances.get(selected.id) ?? 0) > 0
                        ? " due"
                        : (balances.get(selected.id) ?? 0) < 0
                          ? " advance"
                          : ""}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mb-5 grid gap-3 rounded-lg border border-muted-line/30 p-4 sm:grid-cols-[110px_1fr_130px_auto]">
                <Field label="Type">
                  <Select value={type} onChange={(e) => setType(e.target.value as "credit" | "payment")}>
                    <option value="credit">Credit given</option>
                    <option value="payment">Payment received</option>
                  </Select>
                </Field>
                <Field label="Note">
                  <TextInput
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Groceries, part payment"
                  />
                </Field>
                <Field label={`Amount (${currencySymbol(currency)})`}>
                  <NumberInput
                    min={0}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
                <div className="flex items-end">
                  <PrimaryButton onClick={addEntry} disabled={!canAdd}>
                    Add
                  </PrimaryButton>
                </div>
                <Field label="Date">
                  <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
              </div>

              {selectedEntries.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">
                  No entries yet for {selected.name}.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedEntries.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-lg border border-muted-line/30 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {e.type === "credit" ? "Credit given" : "Payment received"}
                          {e.note ? ` — ${e.note}` : ""}
                        </p>
                        <p className="text-xs text-muted">{e.date}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p
                          className={`font-bold ${
                            e.type === "credit" ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {e.type === "credit" ? "+" : "−"}
                          {formatMoney(e.amount, currency)}
                        </p>
                        <button
                          type="button"
                          onClick={() => setDeleting(e)}
                          className="text-xs font-semibold text-red-500 hover:text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete ledger entry?"
        message={
          deleting
            ? `Delete the ${formatMoney(deleting.amount, currency)} ${
                deleting.type === "credit" ? "credit" : "payment"
              } entry for ${deleting.customerName}? Their balance will change.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting) await remove(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
