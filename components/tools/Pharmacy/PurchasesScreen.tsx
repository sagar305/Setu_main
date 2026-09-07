"use client";

import { useMemo, useState } from "react";
import { Download, Plus, Printer, Trash2, Truck } from "lucide-react";
import { usePharmacy } from "@/lib/pharmacy/store";
import { supplierSummary } from "@/lib/pharmacy/reports";
import { downloadCsv, purchasesCsv } from "@/lib/pharmacy/csv";
import { printPurchaseReturn } from "@/lib/pharmacy/print";
import { formatMoney } from "@/lib/pos/types";
import {
  PURCHASE_RETURN_REASON_LABELS,
  formatDate,
  formatExpiry,
  type Purchase,
} from "@/lib/pharmacy/types";
import { PurchaseForm } from "./PurchaseForm";
import { PurchaseReturnModal } from "./PurchaseReturnModal";
import {
  ConfirmDialog,
  EmptyState,
  Modal,
  Pill,
  SearchInput,
  StatCard,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

export function PurchasesScreen() {
  const {
    batches,
    business,
    deletePurchase,
    medicines,
    purchaseReturns,
    purchases,
    settings,
    suppliers,
    updatePurchasePaid,
    supplierById,
  } = usePharmacy();

  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [detail, setDetail] = useState<Purchase | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Purchase | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const currency = business?.currency ?? "INR";

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return purchases;
    return purchases.filter(
      (purchase) =>
        purchase.invoiceNo.toLowerCase().includes(text) ||
        (supplierById(purchase.supplierId)?.name ?? "").toLowerCase().includes(text)
    );
  }, [purchases, query, supplierById]);

  // Outstanding is over all time, not the filtered view — money owed does not
  // stop being owed because the search box has something in it.
  const outstanding = useMemo(
    () =>
      supplierSummary(suppliers, purchases, purchaseReturns, {
        from: "0000-00-00",
        to: "9999-99-99",
      }),
    [purchaseReturns, purchases, suppliers]
  );
  const totalOwed = outstanding.reduce((sum, row) => sum + row.outstanding, 0);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Purchases" value={String(purchases.length)} />
        <StatCard
          label="Owed to distributors"
          value={formatMoney(totalOwed, currency)}
          sub={`${outstanding.filter((row) => row.outstanding > 0).length} suppliers`}
        />
        <StatCard label="Return notes" value={String(purchaseReturns.length)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search invoice number or supplier"
          />
        </div>
        <button type="button" onClick={() => setFormOpen(true)} className={primaryBtnClass}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Enter invoice
        </button>
        <button type="button" onClick={() => setReturnOpen(true)} className={secondaryBtnClass}>
          Return to distributor
        </button>
        <button
          type="button"
          onClick={() => downloadCsv("purchases.csv", purchasesCsv(purchases, suppliers))}
          className={secondaryBtnClass}
          disabled={purchases.length === 0}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export
        </button>
      </div>

      {outstanding.some((row) => row.outstanding > 0) && (
        <div className="rounded-2xl border border-muted-line/30 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
            Outstanding by supplier
          </h3>
          <div className="mt-3 grid gap-2">
            {outstanding
              .filter((row) => row.outstanding > 0)
              .map((row) => (
                <div
                  key={row.supplier?.id ?? "unknown"}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate font-semibold text-ink">
                    {row.supplier?.name ?? "Unknown supplier"}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                    {row.returned > 0 && <span>less {formatMoney(row.returned, currency)} returned</span>}
                    <strong className="text-sm text-ink">
                      {formatMoney(row.outstanding, currency)}
                    </strong>
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Truck className="h-6 w-6" />}
          title={purchases.length === 0 ? "No purchases yet" : "Nothing matches that"}
          message={
            purchases.length === 0
              ? "Stock only exists once an invoice is entered — that is what records the batch number, the expiry and what it cost."
              : "Try the supplier's name."
          }
          action={
            purchases.length === 0 ? (
              <button type="button" onClick={() => setFormOpen(true)} className={primaryBtnClass}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Enter your first invoice
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-2">
          {filtered.map((purchase) => {
            const due = Math.max(0, purchase.total - purchase.paid);
            return (
              <div
                key={purchase.id}
                className="rounded-xl border border-muted-line/30 bg-white p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setDetail(purchase)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-bold text-ink">
                      {purchase.invoiceNo}
                      <span className="ml-2 font-normal text-muted">
                        {supplierById(purchase.supplierId)?.name ?? "Unknown supplier"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDate(purchase.date)} · {purchase.lines.length} line
                      {purchase.lines.length === 1 ? "" : "s"}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-bold text-ink">
                      {formatMoney(purchase.total, currency)}
                    </span>
                    {due > 0 ? (
                      <Pill tone="warn">{formatMoney(due, currency)} due</Pill>
                    ) : (
                      <Pill tone="good">Paid</Pill>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setPayingId(payingId === purchase.id ? null : purchase.id);
                        setPayAmount(String(due));
                      }}
                      className="rounded-lg border border-muted-line/40 px-2 py-1 text-xs font-semibold text-muted hover:border-indigo/40 hover:text-indigo"
                      disabled={due <= 0}
                    >
                      Pay
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(purchase)}
                      className="rounded-lg border border-muted-line/40 p-1.5 text-muted transition hover:border-red-300 hover:text-red-600"
                      aria-label={`Delete purchase ${purchase.invoiceNo}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {payingId === purchase.id && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-muted-line/20 pt-3">
                    <input
                      className={`${inputClass} w-32`}
                      value={payAmount}
                      inputMode="decimal"
                      onChange={(event) => setPayAmount(event.target.value)}
                      aria-label="Amount paid"
                    />
                    <button
                      type="button"
                      className={primaryBtnClass}
                      onClick={async () => {
                        await updatePurchasePaid(
                          purchase.id,
                          purchase.paid + (Number(payAmount) || 0)
                        );
                        setPayingId(null);
                      }}
                    >
                      Record payment
                    </button>
                    <span className="text-xs text-muted">
                      Paid so far {formatMoney(purchase.paid, currency)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {purchaseReturns.length > 0 && (
        <div className="rounded-2xl border border-muted-line/30 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Return notes</h3>
          <div className="mt-3 grid gap-2">
            {purchaseReturns.map((record) => (
              <div
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0">
                  <strong className="text-ink">{record.noteNo}</strong>
                  <span className="ml-2 text-muted">
                    {supplierById(record.supplierId)?.name ?? "—"} · {formatDate(record.date)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Pill tone="muted">{PURCHASE_RETURN_REASON_LABELS[record.reason]}</Pill>
                  <strong className="text-ink">{formatMoney(record.total, currency)}</strong>
                  <button
                    type="button"
                    onClick={() =>
                      printPurchaseReturn(
                        record,
                        supplierById(record.supplierId) ?? null,
                        batches,
                        medicines,
                        business,
                        settings,
                        currency
                      )
                    }
                    className="rounded-lg border border-muted-line/40 p-1.5 text-muted hover:border-indigo/40 hover:text-indigo"
                    aria-label={`Print ${record.noteNo}`}
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <PurchaseForm open={formOpen} onClose={() => setFormOpen(false)} />
      <PurchaseReturnModal open={returnOpen} onClose={() => setReturnOpen(false)} />

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `Invoice ${detail.invoiceNo}` : ""}
        wide
      >
        {detail && (
          <div className="grid gap-3">
            <p className="text-sm text-muted">
              {supplierById(detail.supplierId)?.name ?? "Unknown supplier"} ·{" "}
              {formatDate(detail.date)}
            </p>
            <div className="overflow-x-auto rounded-lg border border-muted-line/30">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="bg-cream-paper">
                  <tr>
                    <th className="p-2 font-semibold text-muted">Medicine</th>
                    <th className="p-2 font-semibold text-muted">Batch</th>
                    <th className="p-2 font-semibold text-muted">Expiry</th>
                    <th className="p-2 text-right font-semibold text-muted">Qty</th>
                    <th className="p-2 text-right font-semibold text-muted">Free</th>
                    <th className="p-2 text-right font-semibold text-muted">Rate</th>
                    <th className="p-2 text-right font-semibold text-muted">MRP</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((line) => (
                    <tr key={line.id} className="border-t border-muted-line/20">
                      <td className="p-2 font-semibold text-ink">
                        {medicines.find((medicine) => medicine.id === line.medicineId)?.name ??
                          "—"}
                      </td>
                      <td className="p-2 text-muted">{line.batchNo}</td>
                      <td className="p-2 text-muted">{formatExpiry(line.expiry)}</td>
                      <td className="p-2 text-right text-muted">{line.quantity}</td>
                      <td className="p-2 text-right text-muted">{line.freeQuantity || "—"}</td>
                      <td className="p-2 text-right text-muted">
                        {formatMoney(line.purchaseRate, currency)}
                      </td>
                      <td className="p-2 text-right text-muted">
                        {formatMoney(line.mrp, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">GST</span>
                <span>{formatMoney(detail.taxTotal, currency)}</span>
              </div>
              <div className="flex justify-between font-bold text-ink">
                <span>Total</span>
                <span>{formatMoney(detail.total, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Paid</span>
                <span>{formatMoney(detail.paid, currency)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={`Delete invoice ${confirmDelete?.invoiceNo ?? ""}?`}
        message="The units it added come back off the shelf, as far as they are still there. Anything already sold cannot be un-sold, and the movement log records what was actually reversed."
        confirmLabel="Delete purchase"
        onConfirm={async () => {
          if (confirmDelete) await deletePurchase(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
