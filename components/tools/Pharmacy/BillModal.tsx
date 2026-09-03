"use client";

import { Check, MessageCircle, Printer } from "lucide-react";
import { usePharmacy } from "@/lib/pharmacy/store";
import { printBill } from "@/lib/pharmacy/print";
import { whatsAppLink } from "@/lib/pharmacy/messages";
import { formatMoney } from "@/lib/pos/types";
import { formatExpiry, type Sale } from "@/lib/pharmacy/types";
import { Modal, primaryBtnClass, secondaryBtnClass } from "./ui";

/**
 * What the counter sees the moment a bill is done.
 *
 * The total, big, and a print button — nothing else competes for the two
 * seconds before the next customer. Batch and expiry are on every line because
 * a customer asking "which lot is this?" at the counter is a question the app
 * should never make someone go looking for.
 */
export function BillModal({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  const { business, customerById, medicines, settings } = usePharmacy();
  if (!sale) return null;

  const currency = business?.currency ?? "INR";
  const customer = sale.customerId ? (customerById(sale.customerId) ?? null) : null;
  const balance = Math.max(0, sale.total - (sale.paid || 0));

  const message = [
    `${business?.name || "Pharmacy"} — bill ${sale.invoiceNo}`,
    ...sale.lines.map(
      (line) => `${line.name} × ${line.quantity} — ${formatMoney(line.amount, currency)}`
    ),
    `Total: ${formatMoney(sale.total, currency)}`,
    balance > 0 ? `Balance due: ${formatMoney(balance, currency)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Modal open onClose={onClose} title={`Bill ${sale.invoiceNo}`}>
      <div className="grid gap-4">
        <div className="rounded-2xl border border-green-300 bg-green-50 p-4 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-white">
            <Check className="h-5 w-5" />
          </span>
          <p className="mt-2 text-2xl font-bold text-ink">
            {formatMoney(sale.total, currency)}
          </p>
          <p className="text-xs font-semibold text-green-800">
            {sale.paymentMode}
            {balance > 0 && ` · ${formatMoney(balance, currency)} still due`}
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
          {customer?.phone && (
            <a
              href={whatsAppLink(customer.phone, message)}
              target="_blank"
              rel="noopener noreferrer"
              className={secondaryBtnClass}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              WhatsApp
            </a>
          )}
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Next customer
          </button>
        </div>
      </div>
    </Modal>
  );
}
