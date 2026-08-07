"use client";

import { useMemo, useRef, useState } from "react";
import { Ban, Download, Printer, Receipt } from "lucide-react";
import { useDine } from "@/lib/dine/store";
import { formatPaise } from "@/lib/dine/money";
import { billsCsv, downloadCsv } from "@/lib/dine/csv";
import { ORDER_TYPE_LABELS, type DineBill } from "@/lib/dine/types";
import { BillView } from "./BillView";
import { PAPER_CONTENT_MM, printNode, printedAt } from "./printing";
import {
  EmptyState,
  Field,
  Modal,
  SearchInput,
  SectionHeading,
  dangerBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

export function BillsScreen({ externalQuery }: { externalQuery?: string }) {
  const { bills, billItems, billPayments, business, settings, cancelBill } = useDine();
  const currency = business?.currency ?? "INR";

  const [query, setQuery] = useState(externalQuery ?? "");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid" | "cancelled">("all");
  const [viewing, setViewing] = useState<DineBill | null>(null);
  const [cancelling, setCancelling] = useState<DineBill | null>(null);
  const [reason, setReason] = useState("");

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return bills
      .filter((bill) => statusFilter === "all" || bill.status === statusFilter)
      .filter(
        (bill) =>
          !search ||
          bill.billLabel.toLowerCase().includes(search) ||
          bill.tableName.toLowerCase().includes(search) ||
          bill.customerName.toLowerCase().includes(search)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [bills, query, statusFilter]);

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Bills"
        subtitle={`${bills.length} bill${bills.length === 1 ? "" : "s"} so far`}
        action={
          <button
            type="button"
            onClick={() => downloadCsv("bills.csv", billsCsv(bills))}
            className={secondaryBtnClass}
            disabled={bills.length === 0}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Bill number, table or customer…"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "paid", "unpaid", "cancelled"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatusFilter(option)}
              aria-pressed={statusFilter === option}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                statusFilter === option ? "bg-indigo text-white" : "text-muted hover:bg-white"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title="No bills yet"
          message="Settle a table and its bill shows up here."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-muted-line/30 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-muted-line/20 bg-cream-paper text-left">
                <th className="px-4 py-2 font-semibold text-muted">Bill</th>
                <th className="px-4 py-2 font-semibold text-muted">When</th>
                <th className="px-4 py-2 font-semibold text-muted">Table</th>
                <th className="px-4 py-2 text-right font-semibold text-muted">Total</th>
                <th className="px-4 py-2 font-semibold text-muted">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((bill) => (
                <tr key={bill.id} className="border-b border-muted-line/10 last:border-0">
                  <td className="px-4 py-2 font-semibold text-ink">
                    {bill.billLabel}
                    {bill.splitCount > 1 && (
                      <span className="ml-1 text-xs font-normal text-muted">
                        ({bill.splitIndex}/{bill.splitCount})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted">{printedAt(bill.createdAt)}</td>
                  <td className="px-4 py-2 text-muted">
                    {bill.tableName || ORDER_TYPE_LABELS[bill.orderType]}
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-ink">
                    {formatPaise(bill.total, currency)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                        bill.status === "paid"
                          ? "bg-green-100 text-green-800"
                          : bill.status === "cancelled"
                            ? "bg-red-100 text-red-700"
                            : "bg-saffron/20 text-ink"
                      }`}
                    >
                      {bill.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setViewing(bill)}
                      className="text-xs font-semibold text-indigo"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewing && (
        <BillDetailModal
          bill={viewing}
          onClose={() => setViewing(null)}
          onCancel={() => {
            setCancelling(viewing);
            setViewing(null);
          }}
        />
      )}

      <Modal
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        title={`Cancel ${cancelling?.billLabel ?? "bill"}?`}
      >
        <p className="text-sm text-muted">
          The bill is marked cancelled and drops out of your sales figures. It is never deleted —
          the record, and the reason, stay in your books.
        </p>
        <div className="mt-4">
          <Field label="Reason">
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="billed twice, guest walked out…"
              className={inputClass}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={() => setCancelling(null)} className={secondaryBtnClass}>
            Keep it
          </button>
          <button
            type="button"
            onClick={async () => {
              if (cancelling) await cancelBill(cancelling.id, reason.trim());
              setCancelling(null);
              setReason("");
            }}
            className={dangerBtnClass}
          >
            <Ban className="h-4 w-4" />
            Cancel bill
          </button>
        </div>
      </Modal>
    </div>
  );

  function BillDetailModal({
    bill,
    onClose,
    onCancel,
  }: {
    bill: DineBill;
    onClose: () => void;
    onCancel: () => void;
  }) {
    const printRef = useRef<HTMLDivElement>(null);
    const items = billItems.filter((item) => item.billId === bill.id);
    const payments = billPayments.filter((payment) => payment.billId === bill.id);

    return (
      <Modal open onClose={onClose} title={bill.billLabel}>
        <div
          className="mx-auto rounded-xl border border-muted-line/40 bg-white p-4"
          style={{
            maxWidth: `${PAPER_CONTENT_MM[settings.billPaperSize] + 16}mm`,
            fontFamily: "ui-monospace, Menlo, Consolas, monospace",
            fontSize: "12px",
            color: "#000",
          }}
        >
          <BillView
            ref={printRef}
            bill={bill}
            items={items}
            payments={payments}
            business={business}
            settings={settings}
          />
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-3">
          {bill.status !== "cancelled" && (
            <button type="button" onClick={onCancel} className={dangerBtnClass}>
              <Ban className="h-4 w-4" />
              Cancel bill
            </button>
          )}
          <button
            type="button"
            onClick={() => printNode(printRef.current, settings.billPaperSize, bill.billLabel)}
            className={primaryBtnClass}
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </Modal>
    );
  }
}
