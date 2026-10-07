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
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useLocalStore, generateLocalId } from "@/lib/hooks/useLocalStore";
import { useFinanceWorkspace } from "@/lib/hooks/useFinanceWorkspace";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { formatMoney } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import { esc } from "@/components/tools/statements/shared";
import { useI18n } from "@/lib/i18n";
import { fill, type TKey } from "@/lib/i18n/translate";
import { intlLocaleFor } from "@/lib/i18n/pages";

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

// The stored value is the kind; what it is called on screen follows the
// reader. The CSV keeps the English label, because a spreadsheet is read by
// machines and formulas as often as by people.
const TYPE_KEY: Record<TxnType, TKey> = {
  invoice: "stTypeInvoice",
  payment: "stTypePayment",
  "credit-note": "stTypeCreditNote",
};

const TYPE_CSV: Record<TxnType, string> = {
  invoice: "Invoice",
  payment: "Payment received",
  "credit-note": "Credit note",
};

const todayIso = () => new Date().toISOString().split("T")[0];

export function CustomerStatementTool() {
  const { code: currency } = usePreferredCurrency();
  const workspace = useFinanceWorkspace("customer-statement");
  const { t, lang } = useI18n();
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
  const [pickedCustomer, setPickedCustomer] = useState("");
  const [deleting, setDeleting] = useState<Txn | null>(null);

  const money = (v: number) => formatMoney(v, currency);
  const typeLabel = (kind: TxnType) => t(TYPE_KEY[kind]);
  const amountNum = Number(amount);
  const canAdd = Number.isFinite(amountNum) && amountNum > 0;

  // Build the statement from a saved customer's ledger: each "credit" (udhaar
  // given) becomes an invoice line, each "payment" a payment line.
  const loadFromLedger = (customerId: string) => {
    setPickedCustomer(customerId);
    if (!customerId) return;
    const customer = workspace.customers.find((c) => c.id === customerId);
    const entries = workspace.ledger.filter((e) => e.customerId === customerId);
    const txns: Txn[] = entries
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({
        id: generateLocalId(),
        date: e.date,
        type: e.type === "credit" ? "invoice" : "payment",
        reference: e.note,
        amount: e.amount,
      }));
    setState((s) => ({
      ...s,
      businessName: s.businessName || workspace.business?.name || "",
      customerName: customer?.name || s.customerName,
      openingBalance: 0,
      txns,
    }));
  };

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
          TYPE_CSV[r.type],
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
          <td>${esc(typeLabel(r.type))}${r.reference ? ` — ${esc(r.reference)}` : ""}</td>
          <td class="r">${r.type === "invoice" ? money(r.amount) : "—"}</td>
          <td class="r">${r.type !== "invoice" ? money(r.amount) : "—"}</td>
          <td class="r">${money(r.balance)}</td>
        </tr>`
      )
      .join("");

    const html = `<!doctype html><html><head><title>${esc(t("stCsTitle"))}</title><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Georgia, "Times New Roman", "Noto Serif", serif, sans-serif; color: #1a1a2e; padding: 48px 56px; }
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
          <p class="biz">${esc(state.businessName || t("stYourBusiness"))}</p>
        </div>
        <p class="doc">${esc(t("stStatementOfAccount"))}</p>
      </div>
      <div class="cust">
        <p class="lbl">${esc(t("stStatementFor"))}</p>
        <p class="cn">${esc(state.customerName || t("customer"))}</p>
      </div>
      <table>
        <thead><tr><th>${esc(t("date"))}</th><th>${esc(t("stParticulars"))}</th><th class="r">${esc(t("bkDebit"))}</th><th class="r">${esc(t("bkCredit"))}</th><th class="r">${esc(t("balance"))}</th></tr></thead>
        <tbody>
          <tr><td></td><td>${esc(t("stOpeningBalanceOwed"))}</td><td class="r">—</td><td class="r">—</td><td class="r">${money(state.openingBalance || 0)}</td></tr>
          ${body}
        </tbody>
      </table>
      <p class="closing">${esc(fill(t("stBalanceDueAmount"), { amount: money(closing) }))}</p>
      <p class="foot">${esc(
        fill(t("stGenerated"), { date: new Date().toLocaleDateString(intlLocaleFor(lang)) })
      )} · ${esc(t("stCsFootnote"))}</p>
      <script>window.onload = () => window.print();</script>
    </body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div>
      <WorkspaceBanner
        connection={workspace}
        message={t("stCsWorkspaceMsg")}
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 text-lg font-bold text-ink">{t("stStatementDetails")}</h2>
          <div className="space-y-4">
            {workspace.connected && workspace.customers.length > 0 ? (
              <Field label={t("stLoadCustomer")}>
                <Select value={pickedCustomer} onChange={(e) => loadFromLedger(e.target.value)}>
                  <option value="">{t("stTypeDetailsBelow")}</option>
                  {workspace.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label={t("tbBusinessName")}>
              <TextInput
                value={state.businessName}
                onChange={(e) => setState((s) => ({ ...s, businessName: e.target.value }))}
              />
            </Field>
            <Field label={t("customerNamePlaceholder")}>
              <TextInput
                value={state.customerName}
                onChange={(e) => setState((s) => ({ ...s, customerName: e.target.value }))}
              />
            </Field>
            <Field label={t("stOpeningBalanceOwed")}>
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
          <h2 className="mb-4 text-lg font-bold text-ink">{t("stAddTransaction")}</h2>
          <div className="space-y-4">
            <Field label={t("date")}>
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t("typeLabel")}>
              <Select value={type} onChange={(e) => setType(e.target.value as TxnType)}>
                <option value="invoice">{t("stTypeInvoiceOpt")}</option>
                <option value="payment">{t("stTypePayment")}</option>
                <option value="credit-note">{t("stTypeCreditNoteOpt")}</option>
              </Select>
            </Field>
            <Field label={t("stReference")}>
              <TextInput
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={t("stReferencePlaceholder")}
              />
            </Field>
            <Field label={t("amount")}>
              <NumberInput
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <PrimaryButton className="w-full" onClick={addTxn} disabled={!canAdd}>
              {t("stAddTransaction")}
            </PrimaryButton>
          </div>
        </Card>
      </div>

      <Card className="h-fit">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">{t("stStatement")}</h2>
          <div className="flex gap-2">
            <SecondaryButton onClick={print} disabled={rows.length === 0}>
              {t("qgPrintPdf")}
            </SecondaryButton>
            <SecondaryButton onClick={exportCsv} disabled={rows.length === 0}>
              {t("exportCsv")}
            </SecondaryButton>
          </div>
        </div>

        <div className="mb-5 rounded-xl bg-cream-paper/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("stBalanceDue")}
          </p>
          <p className={`mt-1 text-2xl font-bold ${closing > 0 ? "text-ink" : "text-emerald-600"}`}>
            {money(closing)}
          </p>
        </div>

        {!loaded ? (
          <p className="py-8 text-center text-sm text-muted">{t("loading")}</p>
        ) : rows.length === 0 ? (
          <EmptyState title={t("stNoTxns")} subtitle={t("stNoTxnsSub")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b-2 border-indigo/30 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">{t("date")}</th>
                  <th className="py-2 pr-3">{t("stParticulars")}</th>
                  <th className="py-2 pr-3 text-right">{t("bkDebit")}</th>
                  <th className="py-2 pr-3 text-right">{t("bkCredit")}</th>
                  <th className="py-2 pr-3 text-right">{t("balance")}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-muted-line/30">
                    <td className="py-2 pr-3 whitespace-nowrap">{row.date}</td>
                    <td className="py-2 pr-3">
                      {typeLabel(row.type)}
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
                        {t("delete")}
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
        title={t("stDeleteTxn")}
        message={
          deleting
            ? // The kind is a translated label, so it goes in as written rather
              // than lowercased — not every language has a lowercase form.
              fill(t("stDeleteTxnMsg"), {
                kind: typeLabel(deleting.type),
                amount: money(deleting.amount),
                date: deleting.date,
              })
            : ""
        }
        confirmLabel={t("delete")}
        onConfirm={() => {
          if (deleting)
            setState((s) => ({ ...s, txns: s.txns.filter((t) => t.id !== deleting.id) }));
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
      </div>
    </div>
  );
}
