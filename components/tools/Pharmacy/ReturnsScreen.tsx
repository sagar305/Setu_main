"use client";

import { useMemo, useState } from "react";
import { Download, Printer, RotateCcw } from "lucide-react";
import { usePharmacy } from "@/lib/pharmacy/store";
import { downloadCsv, returnsCsv } from "@/lib/pharmacy/csv";
import { printPurchaseReturn } from "@/lib/pharmacy/print";
import { formatMoney } from "@/lib/pos/types";
import {
  PURCHASE_RETURN_REASON_LABELS,
  formatDate,
  formatExpiry,
  round2,
  todayKey,
  type Sale,
} from "@/lib/pharmacy/types";
import { PurchaseReturnModal } from "./PurchaseReturnModal";
import {
  EmptyState,
  Modal,
  Pill,
  SearchInput,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

/**
 * Both directions of stock coming back, on one screen.
 *
 * The data model has sale returns and purchase returns but the spec's screen
 * list owned neither. They belong together: the question a chemist actually has
 * is "what came back this month and what did it cost me", and answering it
 * across two screens would mean adding two numbers up by hand.
 */
export function ReturnsScreen() {
  const {
    batches,
    business,
    medicines,
    purchaseReturns,
    sales,
    saleReturns,
    saveSaleReturn,
    settings,
    supplierById,
  } = usePharmacy();

  const [query, setQuery] = useState("");
  const [returningSale, setReturningSale] = useState<Sale | null>(null);
  const [purchaseReturnOpen, setPurchaseReturnOpen] = useState(false);

  const currency = business?.currency ?? "INR";

  const matchingSales = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return sales.slice(0, 10);
    return sales
      .filter((sale) => sale.invoiceNo.toLowerCase().includes(text))
      .slice(0, 20);
  }, [query, sales]);

  const returnedTotal = saleReturns.reduce((sum, row) => sum + row.total, 0);
  const sentBackTotal = purchaseReturns.reduce((sum, row) => sum + row.total, 0);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-muted-line/30 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Returned by customers
          </p>
          <p className="mt-1 text-2xl font-bold text-ink">
            {formatMoney(returnedTotal, currency)}
          </p>
          <p className="text-xs text-muted">
            {saleReturns.length} return{saleReturns.length === 1 ? "" : "s"} · stock went back to
            its own batch
          </p>
        </div>
        <div className="rounded-2xl border border-muted-line/30 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Sent back to distributors
          </p>
          <p className="mt-1 text-2xl font-bold text-ink">
            {formatMoney(sentBackTotal, currency)}
          </p>
          <p className="text-xs text-muted">
            {purchaseReturns.length} note{purchaseReturns.length === 1 ? "" : "s"} · nets off what
            you owe them
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Find a bill by invoice number to take stock back"
          />
        </div>
        <button
          type="button"
          onClick={() => setPurchaseReturnOpen(true)}
          className={secondaryBtnClass}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Return to distributor
        </button>
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "returns.csv",
              returnsCsv(saleReturns, purchaseReturns, [])
            )
          }
          className={secondaryBtnClass}
          disabled={saleReturns.length + purchaseReturns.length === 0}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export
        </button>
      </div>

      <div className="rounded-2xl border border-muted-line/30 bg-white p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
          {query.trim() ? "Matching bills" : "Recent bills"}
        </h3>
        {matchingSales.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No bill matches that number.</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {matchingSales.map((sale) => (
              <div
                key={sale.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-muted-line/30 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{sale.invoiceNo}</p>
                  <p className="text-xs text-muted">
                    {formatDate(sale.date)} · {sale.lines.length} line
                    {sale.lines.length === 1 ? "" : "s"} · {formatMoney(sale.total, currency)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReturningSale(sale)}
                  className={secondaryBtnClass}
                >
                  Take stock back
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {saleReturns.length + purchaseReturns.length === 0 ? (
        <EmptyState
          icon={<RotateCcw className="h-6 w-6" />}
          title="Nothing returned yet"
          message="Customer returns go back to the exact batch they left on, so a strip that comes back is still tracked against its own expiry."
        />
      ) : (
        <div className="rounded-2xl border border-muted-line/30 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">History</h3>
          <div className="mt-3 grid gap-2">
            {saleReturns.map((record) => (
              <div
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-muted-line/20 pb-2 text-sm last:border-0"
              >
                <span className="min-w-0">
                  <Pill tone="info">From customer</Pill>
                  <strong className="ml-2 text-ink">{record.saleInvoiceNo}</strong>
                  <span className="ml-2 text-xs text-muted">
                    {formatDate(record.date)} · {record.reason || "no reason given"}
                  </span>
                </span>
                <strong className="text-ink">{formatMoney(record.total, currency)}</strong>
              </div>
            ))}
            {purchaseReturns.map((record) => (
              <div
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-muted-line/20 pb-2 text-sm last:border-0"
              >
                <span className="min-w-0">
                  <Pill tone="muted">To distributor</Pill>
                  <strong className="ml-2 text-ink">{record.noteNo}</strong>
                  <span className="ml-2 text-xs text-muted">
                    {supplierById(record.supplierId)?.name ?? "—"} · {formatDate(record.date)} ·{" "}
                    {PURCHASE_RETURN_REASON_LABELS[record.reason]}
                  </span>
                </span>
                <span className="flex items-center gap-2">
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

      <SaleReturnModal
        sale={returningSale}
        currency={currency}
        alreadyReturned={saleReturns}
        onClose={() => setReturningSale(null)}
        onSave={saveSaleReturn}
      />

      <PurchaseReturnModal
        open={purchaseReturnOpen}
        onClose={() => setPurchaseReturnOpen(false)}
      />
    </div>
  );
}

/**
 * Take part or all of a bill back.
 *
 * Each line is capped at what has not already come back on an earlier return,
 * so a customer cannot return the same two strips twice — the cap is computed
 * from the stored returns rather than trusted to the operator's memory.
 */
function SaleReturnModal({
  sale,
  currency,
  alreadyReturned,
  onClose,
  onSave,
}: {
  sale: Sale | null;
  currency: string;
  alreadyReturned: { saleId: string; lines: { saleLineId: string; quantity: number }[] }[];
  onClose: () => void;
  onSave: (input: {
    saleId: string;
    date: string;
    reason: string;
    lines: { saleLineId: string; batchId: string; quantity: number; amount: number }[];
  }) => Promise<unknown>;
}) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const returnedSoFar = useMemo(() => {
    const map = new Map<string, number>();
    if (!sale) return map;
    for (const record of alreadyReturned) {
      if (record.saleId !== sale.id) continue;
      for (const line of record.lines) {
        map.set(line.saleLineId, (map.get(line.saleLineId) ?? 0) + line.quantity);
      }
    }
    return map;
  }, [alreadyReturned, sale]);

  if (!sale) return null;

  const lines = sale.lines
    .map((line) => {
      const cap = Math.max(0, line.quantity - (returnedSoFar.get(line.id) ?? 0));
      const quantity = Math.min(cap, Math.max(0, Number(quantities[line.id]) || 0));
      const unitAmount = line.quantity > 0 ? line.amount / line.quantity : 0;
      return {
        saleLineId: line.id,
        batchId: line.batchId,
        quantity,
        amount: round2(quantity * unitAmount),
      };
    })
    .filter((line) => line.quantity > 0);

  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  const submit = async () => {
    if (lines.length === 0) {
      setError("Enter a quantity against at least one line.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ saleId: sale.id, date: todayKey(), reason: reason.trim(), lines });
      setQuantities({});
      setReason("");
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this return.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Return against ${sale.invoiceNo}`} wide>
      <div className="grid gap-4">
        <div className="rounded-lg border border-muted-line/30">
          {sale.lines.map((line) => {
            const cap = Math.max(0, line.quantity - (returnedSoFar.get(line.id) ?? 0));
            return (
              <div
                key={line.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-muted-line/20 p-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{line.name}</p>
                  <p className="text-xs text-muted">
                    B/No {line.batchNo || "—"} · Exp {formatExpiry(line.expiry)} · sold{" "}
                    {line.quantity}
                    {cap < line.quantity && ` · ${line.quantity - cap} already returned`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <input
                    className="h-9 w-20 rounded-lg border border-muted-line/40 px-2 text-right text-sm"
                    value={quantities[line.id] ?? ""}
                    inputMode="numeric"
                    placeholder="0"
                    disabled={cap === 0}
                    onChange={(event) =>
                      setQuantities((previous) => ({ ...previous, [line.id]: event.target.value }))
                    }
                    aria-label={`Quantity of ${line.name} returned`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setQuantities((previous) => ({ ...previous, [line.id]: String(cap) }))
                    }
                    className="text-xs font-semibold text-indigo hover:underline disabled:opacity-40"
                    disabled={cap === 0}
                  >
                    All
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <input
          className={inputClass}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason — wrong medicine, course changed, damaged strip"
        />

        <div className="flex items-center justify-between rounded-xl border border-muted-line/30 bg-cream-paper p-3">
          <span className="text-sm text-muted">Refund value</span>
          <strong className="text-lg text-ink">{formatMoney(total, currency)}</strong>
        </div>

        <p className="text-xs text-muted">
          Returned stock goes back to the batch it was sold from, expiry and all. If that batch
          has since expired it will show up on the expiry screen, which is where it belongs.
        </p>

        {error && (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void submit()}
            className={`${primaryBtnClass} sm:flex-1`}
            disabled={saving}
          >
            {saving ? "Saving…" : "Record return"}
          </button>
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
