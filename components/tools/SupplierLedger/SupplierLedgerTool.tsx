"use client";

// Supplier Ledger — what the shop owes each supplier, and what it has paid.
// The mirror image of the Customer Ledger (udhaar): suppliers are the SHARED
// workspace entity (the same book the Supplier Book and Purchase Register
// use), and credit purchases from the Purchase Register appear here on their
// own — read live, never copied. This tool owns only the payments made and
// any bills/opening balances typed in by hand (the supplier_ledger store).
// Balances and bill-wise outstanding come from lib/toolkit/payables.ts, the
// same engine the Accounts Payable Aging report uses.

import { useEffect, useMemo, useState } from "react";
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
import { useFinanceWorkspace } from "@/lib/hooks/useFinanceWorkspace";
import { useEntityList } from "@/lib/hooks/useEntityList";
import { putRecord } from "@/lib/toolkit/workspace";
import type { Supplier, SupplierLedgerEntry } from "@/lib/toolkit/types";
import { currencySymbol, formatMoney, generateId, nowIso } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import {
  computePayables,
  isCreditPurchase,
  makePartyResolver,
  purchaseBillRef,
  type OpenBill,
} from "@/lib/toolkit/payables";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";

const todayIso = () => new Date().toISOString().split("T")[0];

const PAYMENT_MODES = ["Cash", "UPI", "Bank transfer", "Cheque", "Card"];

type StatementRow = {
  key: string;
  date: string;
  sortKey: string;
  label: string;
  detail: string;
  /** Positive = bill (you owe more), negative = payment. */
  signed: number;
  source: "purchase" | "ledger";
  entry?: SupplierLedgerEntry;
};

export function SupplierLedgerTool() {
  const { t } = useI18n();
  const workspace = useFinanceWorkspace("supplier-ledger");
  const { items: entries, save, remove } = useEntityList<SupplierLedgerEntry>("supplier_ledger");

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [type, setType] = useState<"payment" | "bill">("payment");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayIso());
  const [mode, setMode] = useState("Cash");
  const [billRef, setBillRef] = useState("");
  const [deleting, setDeleting] = useState<SupplierLedgerEntry | null>(null);
  const [paying, setPaying] = useState<OpenBill | null>(null);
  const [pullNote, setPullNote] = useState<string | null>(null);

  const currency = workspace.business?.currency ?? "INR";
  const money = (v: number) => formatMoney(v, currency);

  const positions = useMemo(
    () => computePayables(workspace.suppliers, workspace.purchases, entries),
    [workspace.suppliers, workspace.purchases, entries],
  );

  const parties = useMemo(
    () =>
      [...positions.values()].sort(
        (a, b) => b.balance - a.balance || a.name.localeCompare(b.name),
      ),
    [positions],
  );

  const totalPayable = useMemo(
    () => parties.reduce((s, p) => s + Math.max(0, p.balance), 0),
    [parties],
  );
  const openBillCount = useMemo(
    () => parties.reduce((n, p) => n + p.bills.filter((b) => b.outstanding > 0).length, 0),
    [parties],
  );

  const selected = selectedKey ? positions.get(selectedKey) ?? null : null;
  const selectedOpenBills = selected ? selected.bills.filter((b) => b.outstanding > 0) : [];

  // Statement for the selected supplier: credit purchases from the register
  // plus this tool's own entries, oldest first with a running balance.
  const statement = useMemo(() => {
    if (!selected) return [] as (StatementRow & { running: number })[];
    const resolve = makePartyResolver(workspace.suppliers);
    const rows: StatementRow[] = [];
    for (const p of workspace.purchases) {
      if (!isCreditPurchase(p) || !(p.total > 0)) continue;
      if (resolve(p.supplierId, p.supplierName) !== selected.key) continue;
      rows.push({
        key: purchaseBillRef(p.id),
        date: p.date,
        sortKey: p.createdAt,
        label: t("slCreditPurchase"),
        detail: [
          p.billNumber ? fill(t("slBillNo"), { number: p.billNumber }) : "",
          p.items.map((i) => `${i.name} ×${i.quantity}`).join(", "),
        ]
          .filter(Boolean)
          .join(" · "),
        signed: p.total,
        source: "purchase",
      });
    }
    for (const e of entries) {
      if (resolve(e.supplierId, e.supplierName) !== selected.key) continue;
      const linked = e.billRef ? selected.bills.find((b) => b.ref === e.billRef) : undefined;
      rows.push({
        key: e.id,
        date: e.date,
        sortKey: e.createdAt,
        label: e.type === "bill" ? t("slBillOpening") : t("slPaymentMade"),
        detail: [
          e.type === "payment" && e.paymentMode ? e.paymentMode : "",
          linked
            ? fill(t("slAgainstRef"), {
                ref: fill(t("slBillNo"), { number: linked.number || linked.date }),
              })
            : "",
          e.note,
        ]
          .filter(Boolean)
          .join(" · "),
        signed: e.type === "bill" ? e.amount : -e.amount,
        source: "ledger",
        entry: e,
      });
    }
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.sortKey.localeCompare(b.sortKey));
    let running = 0;
    return rows.map((r) => {
      running += r.signed;
      return { ...r, running };
    });
  }, [selected, workspace.suppliers, workspace.purchases, entries, t]);

  // Credit purchases are read live from the Purchase Register; pulling just
  // re-reads the register (connecting the workspace first if needed) so bills
  // recorded in another tab show up, and says how many were found.
  const pullCreditPurchases = async () => {
    if (!workspace.connected) await workspace.connect();
    else await workspace.reload();
  };
  const creditPurchases = useMemo(
    () => workspace.purchases.filter((p) => isCreditPurchase(p) && p.total > 0),
    [workspace.purchases],
  );
  const [pullCount, setPullCount] = useState(0);
  useEffect(() => {
    if (pullCount === 0) return;
    const resolve = makePartyResolver(workspace.suppliers);
    const partyCount = new Set(creditPurchases.map((p) => resolve(p.supplierId, p.supplierName))).size;
    setPullNote(
      creditPurchases.length === 0
        ? t("slNoCreditPurchases")
        : fill(t("slPulledNote"), { count: creditPurchases.length, suppliers: partyCount }),
    );
  }, [pullCount, creditPurchases, workspace.suppliers, t]);

  const addSupplier = async () => {
    if (!newName.trim()) return;
    // A NEW supplier goes into the shared workspace book, so the Supplier
    // Book and Purchase Register see them too.
    const now = nowIso();
    const supplier: Supplier = {
      id: generateId(),
      name: newName.trim(),
      phone: newPhone.trim(),
      email: "",
      gstin: "",
      address: "",
      notes: "",
      createdByTool: "supplier-ledger",
      createdAt: now,
      updatedAt: now,
    };
    await putRecord("suppliers", supplier);
    await workspace.reload();
    setSelectedKey(`id:${supplier.id}`);
    setNewName("");
    setNewPhone("");
  };

  const selectParty = (key: string) => {
    setSelectedKey(key);
    setBillRef("");
    setAmount("");
  };

  const pickBill = (ref: string) => {
    setBillRef(ref);
    const bill = selectedOpenBills.find((b) => b.ref === ref);
    if (bill) setAmount(bill.outstanding.toFixed(2));
  };

  const amountNum = Number(amount);
  const canAdd = !!selected && Number.isFinite(amountNum) && amountNum > 0;

  const addEntry = async () => {
    if (!selected || !canAdd) return;
    await save({
      id: generateId(),
      supplierId: selected.supplierId,
      supplierName: selected.name,
      type,
      amount: amountNum,
      note: note.trim(),
      date,
      paymentMode: type === "payment" ? mode : undefined,
      billRef: type === "payment" && billRef ? billRef : undefined,
      createdByTool: "supplier-ledger",
      createdAt: nowIso(),
    });
    setAmount("");
    setNote("");
    setBillRef("");
  };

  const payInFull = async (bill: OpenBill) => {
    if (!selected) return;
    await save({
      id: generateId(),
      supplierId: selected.supplierId,
      supplierName: selected.name,
      type: "payment",
      amount: Math.round(bill.outstanding * 100) / 100,
      note: "",
      date: todayIso(),
      paymentMode: mode,
      billRef: bill.ref,
      createdByTool: "supplier-ledger",
      createdAt: nowIso(),
    });
  };

  const exportCsv = () => {
    const resolve = makePartyResolver(workspace.suppliers);
    const nameOf = (key: string, fallback: string) => positions.get(key)?.name ?? fallback;
    const rows: { date: string; cells: string[] }[] = [];
    for (const p of workspace.purchases) {
      if (!isCreditPurchase(p) || !(p.total > 0)) continue;
      rows.push({
        date: p.date,
        cells: [
          p.date,
          nameOf(resolve(p.supplierId, p.supplierName), p.supplierName),
          "Credit purchase",
          p.billNumber,
          p.total.toFixed(2),
          "",
          "",
          "Purchase Register",
        ],
      });
    }
    for (const e of entries) {
      rows.push({
        date: e.date,
        cells: [
          e.date,
          nameOf(resolve(e.supplierId, e.supplierName), e.supplierName),
          e.type === "bill" ? "Bill / opening balance" : "Payment made",
          "",
          e.type === "bill" ? e.amount.toFixed(2) : "",
          e.type === "payment" ? e.amount.toFixed(2) : "",
          e.paymentMode ?? "",
          e.note,
        ],
      });
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    downloadCsv(
      "supplier-ledger.csv",
      toCsv(
        ["Date", "Supplier", "Type", "Bill No", "Billed", "Paid", "Mode", "Note"],
        rows.map((r) => r.cells),
      ),
    );
  };

  const hasAnything = entries.length > 0 || workspace.purchases.some(isCreditPurchase);

  return (
    <div>
      <WorkspaceBanner
        connection={workspace}
        message={t("slConnectHint")}
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl bg-cream-paper/70 px-5 py-4">
        <p className="text-sm text-muted">
          {t("slTotalPayable")}:{" "}
          <span className="text-lg font-bold text-ink">{money(totalPayable)}</span>
        </p>
        <p className="text-sm text-muted">
          {t("slOpenCreditBills")}: <span className="font-bold text-ink">{openBillCount}</span>
        </p>
        <SecondaryButton
          onClick={async () => {
            await pullCreditPurchases();
            setPullCount((n) => n + 1);
          }}
        >
          ↻ {t("slPullCredit")}
        </SecondaryButton>
        <SecondaryButton onClick={exportCsv} disabled={!hasAnything}>
          {t("exportCsv")}
        </SecondaryButton>
        {pullNote ? (
          <p className="w-full text-xs font-medium text-emerald-600">{pullNote}</p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit min-w-0">
          <h2 className="mb-4 text-lg font-bold text-ink">{t("slSuppliers")}</h2>

          <div className="mb-4 space-y-2 rounded-lg border border-muted-line/30 p-3">
            <TextInput
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("slNewSupplier")}
            />
            <TextInput
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder={t("phoneOptional")}
            />
            <PrimaryButton className="w-full" onClick={addSupplier} disabled={!newName.trim()}>
              {t("slAddSupplier")}
            </PrimaryButton>
          </div>

          {parties.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">
              {workspace.exists && !workspace.connected
                ? t("slConnectForSuppliers")
                : t("slNoSuppliers")}
            </p>
          ) : (
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {parties.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => selectParty(p.key)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                    selectedKey === p.key ? "bg-indigo/10" : "hover:bg-cream-paper"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                    <span className="text-xs text-muted">
                      {p.phone || (p.key.startsWith("name:") ? t("slNotInBook") : "")}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-sm font-bold ${
                      p.balance > 0.005
                        ? "text-red-600"
                        : p.balance < -0.005
                          ? "text-emerald-600"
                          : "text-muted"
                    }`}
                  >
                    {Math.abs(p.balance) < 0.005 ? t("settled") : money(Math.abs(p.balance))}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="h-fit min-w-0">
          {!selected ? (
            <EmptyState title={t("slPickTitle")} subtitle={t("slPickHint")} />
          ) : (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-bold text-ink">{selected.name}</h2>
                <p className="text-sm text-muted">
                  {selected.balance > 0.005 ? (
                    <>
                      {t("slYouOwe")}{" "}
                      <span className="font-bold text-red-600">{money(selected.balance)}</span>
                    </>
                  ) : selected.balance < -0.005 ? (
                    <>
                      {t("slAdvancePaid")}{" "}
                      <span className="font-bold text-emerald-600">
                        {money(Math.abs(selected.balance))}
                      </span>
                    </>
                  ) : (
                    <span className="font-semibold text-emerald-600">{t("slSettledNothing")}</span>
                  )}
                  <span className="ml-2 text-xs">
                    ({fill(t("slBilledPaid"), {
                      billed: money(selected.billed),
                      paid: money(selected.paid),
                    })})
                  </span>
                </p>
              </div>

              <div className="mb-5 grid gap-3 rounded-lg border border-muted-line/30 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label={t("slEntryType")}>
                  <Select
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value as "payment" | "bill");
                      setBillRef("");
                    }}
                  >
                    <option value="payment">{t("slPaymentMade")}</option>
                    <option value="bill">{t("slBillOpening")}</option>
                  </Select>
                </Field>
                {type === "payment" ? (
                  <>
                    <Field label={t("slAgainstBill")}>
                      <Select value={billRef} onChange={(e) => pickBill(e.target.value)}>
                        <option value="">{t("slOldestFirst")}</option>
                        {selectedOpenBills.map((b) => (
                          <option key={b.ref} value={b.ref}>
                            {b.date}
                            {b.number ? ` · ${b.number}` : ""} ·{" "}
                            {fill(t("slAmountDue"), { amount: money(b.outstanding) })}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t("slPaidBy")}>
                      <Select value={mode} onChange={(e) => setMode(e.target.value)}>
                        {PAYMENT_MODES.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </Select>
                    </Field>
                  </>
                ) : null}
                <Field label={`${t("amount")} (${currencySymbol(currency)})`}>
                  <NumberInput
                    min={0}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
                <Field label={t("date")}>
                  <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <Field label={t("notes")}>
                  <TextInput
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={type === "bill" ? t("slNoteBillPlaceholder") : t("slNotePayPlaceholder")}
                  />
                </Field>
                <div className="flex items-end sm:col-span-2 lg:col-span-3">
                  <PrimaryButton onClick={addEntry} disabled={!canAdd}>
                    {type === "payment" ? t("slRecordPayment") : t("slAddBill")}
                  </PrimaryButton>
                </div>
              </div>

              <h3 className="mb-2 text-sm font-bold text-ink">
                {fill(t("slOpenBillsCount"), { count: selectedOpenBills.length })}
              </h3>
              {selectedOpenBills.length === 0 ? (
                <p className="mb-5 text-sm text-muted">{t("slNoOpenBills")}</p>
              ) : (
                <div className="mb-5 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-muted-line/40 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                        <th className="py-2 pr-3">{t("date")}</th>
                        <th className="py-2 pr-3">{t("slBill")}</th>
                        <th className="py-2 pr-3 text-right">{t("amount")}</th>
                        <th className="py-2 pr-3 text-right">{t("slPaid")}</th>
                        <th className="py-2 pr-3 text-right">{t("due")}</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOpenBills.map((b) => (
                        <tr key={b.ref} className="border-b border-muted-line/20">
                          <td className="py-2 pr-3">{b.date}</td>
                          <td className="py-2 pr-3">
                            {b.number || "—"}
                            <span className="ml-1 text-xs text-muted">
                              {b.source === "purchase" ? t("slFromRegister") : t("slEnteredHere")}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right">{money(b.amount)}</td>
                          <td className="py-2 pr-3 text-right">{b.paid > 0 ? money(b.paid) : "—"}</td>
                          <td className="py-2 pr-3 text-right font-bold text-red-600">
                            {money(b.outstanding)}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setPaying(b)}
                              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                            >
                              {t("slPayInFull")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h3 className="mb-2 text-sm font-bold text-ink">{t("slStatement")}</h3>
              {statement.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">
                  {fill(t("slNoEntries"), { name: selected.name })}
                </p>
              ) : (
                <div className="space-y-2">
                  {[...statement].reverse().map((r) => (
                    <div
                      key={r.key}
                      className="flex items-center justify-between gap-3 rounded-lg border border-muted-line/30 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">
                          {r.label}
                          {r.source === "purchase" ? (
                            <span className="ml-2 rounded-full bg-indigo/10 px-2 py-0.5 text-[11px] font-semibold text-indigo">
                              {t("slPurchaseRegister")}
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {r.date}
                          {r.detail ? ` · ${r.detail}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-4">
                        <div className="text-right">
                          <p
                            className={`font-bold ${r.signed > 0 ? "text-red-600" : "text-emerald-600"}`}
                          >
                            {r.signed > 0 ? "+" : "−"}
                            {money(Math.abs(r.signed))}
                          </p>
                          <p className="text-[11px] text-muted">
                            {fill(t("slBalShort"), { amount: money(r.running) })}
                          </p>
                        </div>
                        {r.entry ? (
                          <button
                            type="button"
                            onClick={() => setDeleting(r.entry!)}
                            className="text-xs font-semibold text-red-500 hover:text-red-600"
                          >
                            {t("delete")}
                          </button>
                        ) : (
                          <span className="w-[38px]" aria-hidden />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-4 text-xs text-muted">
                {t("slCreditOnlyHint")}
              </p>
            </>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting?.type === "bill" ? t("slDeleteBillTitle") : t("slDeletePaymentTitle")}
        message={
          deleting
            ? fill(t("slDeleteMessage"), {
                amount: money(deleting.amount),
                name: deleting.supplierName,
              })
            : ""
        }
        confirmLabel={t("delete")}
        onConfirm={async () => {
          if (deleting) await remove(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={paying !== null}
        title={t("slPayFullTitle")}
        message={
          paying
            ? fill(t("slPayFullMessage"), {
                mode,
                amount: money(paying.outstanding),
                name: paying.partyName,
              })
            : ""
        }
        confirmLabel={t("slRecordPayment")}
        danger={false}
        onConfirm={async () => {
          if (paying) await payInFull(paying);
          setPaying(null);
        }}
        onCancel={() => setPaying(null)}
      />
    </div>
  );
}
