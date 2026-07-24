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
import { esc } from "@/components/tools/statements/shared";

type TxnType = "invoice" | "payment" | "credit-note";

type Txn = {
  id: string;
  date: string;
  type: TxnType;
  reference: string;
  amount: number;
};

type StatementState = {
  businessName: string;
  customerName: string;
  openingBalance: number;
  txns: Txn[];
};

const TYPE_LABEL: Record<TxnType, string> = {
  invoice: "Invoice",
  payment: "Payment received",
  "credit-note": "Credit note",
};

const todayIso = () => new Date().toISOString().split("T")[0];

export function CustomerStatementTool() {
  const { code: currency } = usePreferredCurrency();
  const [state, setState, loaded] = useLocalStore<StatementState>("setu-stmt-customer", {
    businessName: "",
    customerName: "",
    openingBalance: 0,
    txns: [],
  });

  const [date, setDate] = useState(todayIso());
  const [type, setType] = useState<TxnType>("invoice");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [deleting, setDeleting] = useState<Txn | null>(null);

  const money = (v: number) => formatMoney(v, currency);
  const amountNum = Number(amount);
  const canAdd = Number.isFinite(amountNum) && amountNum > 0;

  const addTxn = () => {
    if (!canAdd) return;
    setState((s) => ({
      ...s,
      txns: [
        ...s.txns,
        { id: generateLocalId(), date, type, reference: reference.trim(), amount: amountNum },
      ],
    }));
    setReference("");
    setAmount("");
  };

  // Invoices increase what the customer owes; payments and credit notes reduce it.
  const rows = useMemo(() => {
    const sorted = [...state.txns].sort((a, b) => a.date.localeCompare(b.date));
    let balance = state.openingBalance || 0;
    return sorted.map((t) => {
      balance += t.type === "invoice" ? t.amount : -t.amount;
      return { ...t, balance };
    });
  }, [state.txns, state.openingBalance]);

  const closing = rows.length > 0 ? rows[rows.length - 1].balance : state.openingBalance || 0;

  const exportCsv = () =>
    downloadCsv(
      "customer-statement.csv",
      toCsv(
        ["Date", "Type", "Reference", "Debit", "Credit", "Balance"],
        rows.map((r) => [
          r.date,
          TYPE_LABEL[r.type],
          r.reference,
          r.type === "invoice" ? r.amount.toFixed(2) : "",
          r.type !== "invoice" ? r.amount.toFixed(2) : "",
          r.balance.toFixed(2),
        ])
      )
    );

  const print = () => {
    const body = rows
      .map(
        (r) => `<tr>
          <td>${esc(r.date)}</td>
          <td>${esc(TYPE_LABEL[r.type])}${r.reference ? ` — ${esc(r.reference)}` : ""}</td>
          <td class="r">${r.type === "invoice" ? money(r.amount) : "—"}</td>
          <td class="r">${r.type !== "invoice" ? money(r.amount) : "—"}</td>
          <td class="r">${money(r.balance)}</td>
        </tr>`
      )
      .join("");

    const html = `<!doctype html><html><head><title>Customer Statement</title><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Georgia, "Times New Roman", serif; color: #1a1a2e; padding: 48px 56px; }
      @page { size: A4; margin: 0; }
      .head { display: flex; justify-content: space-between; margin-bottom: 28px; }
      .head .biz { font-size: 18px; font-weight: bold; }
      .head .doc { font-size: 12px; text-transform: uppercase; letter-spacing: 3px; color: #26306B; }
      .cust { margin-bottom: 20px; font-size: 13px; }
      .cust .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #8a8a9a; }
      .cust .cn { font-weight: bold; font-size: 15px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #8a8a9a; border-bottom: 2px solid #26306B; padding: 8px 6px; }
      th.r { text-align: right; }
      td { padding: 8px 6px; border-bottom: 1px solid #ececf2; }
      .r { text-align: right; white-space: nowrap; }
      .closing { margin-top: 18px; text-align: right; font-size: 15px; font-weight: bold; color: #26306B; }
      .foot { margin-top: 36px; font-size: 11px; color: #8a8a9a; }
    </style></head><body>
      <div class="head">
        <div>
          <p class="biz">${esc(state.businessName || "Your Business")}</p>
        </div>
        <p class="doc">Statement of Account</p>
      </div>
      <div class="cust">
        <p class="lbl">Statement for</p>
        <p class="cn">${esc(state.customerName || "Customer")}</p>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Particulars</th><th class="r">Debit</th><th class="r">Credit</th><th class="r">Balance</th></tr></thead>
        <tbody>
          <tr><td></td><td>Opening balance</td><td class="r">—</td><td class="r">—</td><td class="r">${money(state.openingBalance || 0)}</td></tr>
          ${body}
        </tbody>
      </table>
      <p class="closing">Balance due: ${money(closing)}</p>
      <p class="foot">Generated ${new Date().toLocaleDateString("en-IN")} · Debit = invoiced to you, Credit = payments & adjustments.</p>
      <script>window.onload = () => window.print();</script>
    </body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 text-lg font-bold text-ink">Statement details</h2>
          <div className="space-y-4">
            <Field label="Your business name">
              <TextInput
                value={state.businessName}
                onChange={(e) => setState((s) => ({ ...s, businessName: e.target.value }))}
              />
            </Field>
            <Field label="Customer name">
              <TextInput
                value={state.customerName}
                onChange={(e) => setState((s) => ({ ...s, customerName: e.target.value }))}
              />
            </Field>
            <Field label="Opening balance (amount already owed)">
              <NumberInput
                step="0.01"
                value={state.openingBalance || ""}
                onChange={(e) =>
                  setState((s) => ({ ...s, openingBalance: Number(e.target.value) || 0 }))
                }
                placeholder="0.00"
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold text-ink">Add transaction</h2>
          <div className="space-y-4">
            <Field label="Date">
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value as TxnType)}>
                <option value="invoice">Invoice (customer owes more)</option>
                <option value="payment">Payment received</option>
                <option value="credit-note">Credit note / adjustment</option>
              </Select>
            </Field>
            <Field label="Reference">
              <TextInput
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. INV-1042 or UPI ref"
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
            <PrimaryButton className="w-full" onClick={addTxn} disabled={!canAdd}>
              Add transaction
            </PrimaryButton>
          </div>
        </Card>
      </div>

      <Card className="h-fit">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Statement</h2>
          <div className="flex gap-2">
            <SecondaryButton onClick={print} disabled={rows.length === 0}>
              Print / PDF
            </SecondaryButton>
            <SecondaryButton onClick={exportCsv} disabled={rows.length === 0}>
              Export CSV
            </SecondaryButton>
          </div>
        </div>

        <div className="mb-5 rounded-xl bg-cream-paper/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Balance due</p>
          <p className={`mt-1 text-2xl font-bold ${closing > 0 ? "text-ink" : "text-emerald-600"}`}>
            {money(closing)}
          </p>
        </div>

        {!loaded ? (
          <p className="py-8 text-center text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            subtitle="Add the customer's invoices, payments and credit notes — the running balance builds the statement automatically."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b-2 border-indigo/30 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Particulars</th>
                  <th className="py-2 pr-3 text-right">Debit</th>
                  <th className="py-2 pr-3 text-right">Credit</th>
                  <th className="py-2 pr-3 text-right">Balance</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-muted-line/30">
                    <td className="py-2 pr-3 whitespace-nowrap">{row.date}</td>
                    <td className="py-2 pr-3">
                      {TYPE_LABEL[row.type]}
                      {row.reference ? <span className="text-muted"> — {row.reference}</span> : null}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {row.type === "invoice" ? money(row.amount) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {row.type !== "invoice" ? money(row.amount) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium">{money(row.balance)}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setDeleting(row)}
                        className="text-xs font-semibold text-red-500 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete transaction?"
        message={
          deleting
            ? `Delete the ${TYPE_LABEL[deleting.type].toLowerCase()} of ${money(deleting.amount)} dated ${deleting.date}?`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleting)
            setState((s) => ({ ...s, txns: s.txns.filter((t) => t.id !== deleting.id) }));
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
