"use client";

import { useState } from "react";
import { Check, Printer, Share2 } from "lucide-react";
import { usePharmacy } from "@/lib/pharmacy/store";
import { printBill } from "@/lib/pharmacy/print";
import { saleDoc } from "@/lib/pharmacy/share";
import { ShareDialog } from "@/components/toolkit/ShareDialog";
import type { SharedDoc } from "@/lib/toolkit/shareLink";
import { formatMoney } from "@/lib/pos/types";
import { formatDate, formatExpiry, type Sale } from "@/lib/pharmacy/types";
import { Modal, primaryBtnClass, secondaryBtnClass } from "./ui";

/**
 * A bill, after it is rung up and whenever it is looked at again.
 *
 * The total, big, and a print button — nothing else competes for the two
 * seconds before the next customer. Batch and expiry are on every line because
 * a customer asking "which lot is this?" at the counter is a question the app
 * should never make someone go looking for.
 *
 * `justSold` is the difference between the two moments it opens. Straight after
 * a sale the closing button says "Next customer", because that is what the
 * operator is about to do; reopened from a customer's ledger a week later it
 * says "Close", because there is no queue.
 */
export function BillModal({
  sale,
  justSold = false,
  onClose,
}: {
  sale: Sale | null;
  justSold?: boolean;
  onClose: () => void;
}) {
  const { business, customerById, medicines, settings, updateBusiness } = usePharmacy();
  const [sharing, setSharing] = useState<SharedDoc | null>(null);

  if (!sale) return null;

  const currency = business?.currency ?? "INR";
  const customer = sale.customerId ? (customerById(sale.customerId) ?? null) : null;
  const balance = Math.max(0, sale.total - (sale.paid || 0));

  return (
    <Modal open onClose={onClose} title={`Bill ${sale.invoiceNo}`}>
      <div className="grid gap-4">
        <div
          className={`rounded-2xl border p-4 text-center ${
            justSold ? "border-green-300 bg-green-50" : "border-muted-line/30 bg-cream-paper"
          }`}
        >
          {justSold && (
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-white">
              <Check className="h-5 w-5" />
            </span>
          )}
          <p className="mt-2 text-2xl font-bold text-ink">
            {formatMoney(sale.total, currency)}
          </p>
          <p className={`text-xs font-semibold ${justSold ? "text-green-800" : "text-muted"}`}>
            {sale.paymentMode}
            {balance > 0 && ` · ${formatMoney(balance, currency)} still due`}
            {!justSold && ` · ${formatDate(sale.date)}`}
          </p>
        </div>

        <div className="max-h-56 overflow-y-auto rounded-lg border border-muted-line/30">
          {sale.lines.map((line) => (
            <div
              key={line.id}
              className="flex items-start justify-between gap-3 border-b border-muted-line/20 px-3 py-2 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{line.name}</p>
                <p className="text-xs text-muted">
                  B/No {line.batchNo || "—"} · Exp {formatExpiry(line.expiry)} · {line.quantity} ×{" "}
                  {formatMoney(line.rate, currency)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-ink">
                {formatMoney(line.amount, currency)}
              </span>
            </div>
          ))}
        </div>

        {sale.prescription && (
          <p className="text-xs text-muted">
            Rx: {sale.prescription.patientName} · Dr {sale.prescription.doctorName}
            {sale.prescription.doctorRegNo && ` (${sale.prescription.doctorRegNo})`}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() =>
              printBill({ sale, business, settings, customer, medicines, currency })
            }
            className={`${primaryBtnClass} sm:flex-1`}
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print bill
          </button>
          <button
            type="button"
            onClick={() => setSharing(saleDoc(business, sale, customer, settings))}
            className={`${secondaryBtnClass} sm:flex-1`}
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Share link
          </button>
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            {justSold ? "Next customer" : "Close"}
          </button>
        </div>

        {/*
          The share sheet handles WhatsApp (to this customer's number when we
          know it), copy, native share and a QR of the link. The bill itself
          rides in the fragment, so nothing is uploaded unless the owner has
          turned link shortening on.
        */}
        <ShareDialog
          open={sharing !== null}
          onClose={() => setSharing(null)}
          doc={sharing}
          title="Share bill"
          onSaveUpiDefault={(upiId) => void updateBusiness({ upiId })}
        />
      </div>
    </Modal>
  );
}
