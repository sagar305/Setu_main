"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, Receipt, ReceiptText } from "lucide-react";
import { usePos } from "@/lib/pos/store";
import { formatMoney, type Order } from "@/lib/pos/types";
import { ReceiptModal } from "./ReceiptModal";
import { ConfirmDialog, EmptyState, SearchInput, inputClass } from "./ui";

type StatusFilter = "all" | "completed" | "cancelled";

export function OrdersScreen({
  externalQuery,
}: {
  externalQuery: { value: string; nonce: number } | null;
}) {
  const { business, orders, orderItems, cancelOrder } = usePos();
  const currency = business?.currency ?? "INR";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewTarget, setViewTarget] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);

  useEffect(() => {
    if (externalQuery) setSearch(externalQuery.value);
  }, [externalQuery]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((order) => (statusFilter === "all" ? true : order.status === statusFilter))
      .filter(
        (order) =>
          !q ||
          order.invoiceNumber.toLowerCase().includes(q) ||
          order.customerName.toLowerCase().includes(q)
      );
  }, [orders, search, statusFilter]);

  const itemSummary = (orderId: string) => {
    const items = orderItems.filter((item) => item.orderId === orderId);
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    return `${count} item${count === 1 ? "" : "s"}`;
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by invoice number or customer…"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className={`${inputClass} sm:w-44`}
          aria-label="Filter by status"
        >
          <option value="all">All orders</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {orders.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="No orders yet"
            message="Every sale you complete is saved here with its receipt."
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-muted-line/30 bg-white">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-muted-line/20 text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-semibold">Invoice</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted-line/15">
              {filtered.map((order) => (
                <tr
                  key={order.id}
                  className={`hover:bg-cream-paper/60 ${
                    order.status === "cancelled" ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-semibold text-ink">
                    {order.invoiceNumber}
                    {order.status === "cancelled" && (
                      <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-500">
                        Cancelled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(order.date).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted">{order.customerName || "Walk-in"}</td>
                  <td className="px-4 py-3 text-muted">{itemSummary(order.id)}</td>
                  <td className="px-4 py-3 text-muted">{order.paymentMethodName}</td>
                  <td className="px-4 py-3 text-right font-bold text-ink">
                    {formatMoney(order.total, currency)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`View receipt ${order.invoiceNumber}`}
                        title="View / print receipt"
                        onClick={() => setViewTarget(order)}
                        className="rounded-lg p-2 text-muted transition hover:bg-cream hover:text-indigo"
                      >
                        <ReceiptText className="h-4 w-4" />
                      </button>
                      {order.status === "completed" && (
                        <button
                          type="button"
                          aria-label={`Cancel order ${order.invoiceNumber}`}
                          title="Cancel order"
                          onClick={() => setCancelTarget(order)}
                          className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-500"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    No orders match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ReceiptModal
        order={viewTarget}
        open={viewTarget !== null}
        onClose={() => setViewTarget(null)}
      />
      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel this order?"
        message={`${cancelTarget?.invoiceNumber} will be marked cancelled and tracked stock will be restored. This cannot be undone.`}
        confirmLabel="Cancel order"
        onConfirm={() => {
          if (cancelTarget) void cancelOrder(cancelTarget.id);
          setCancelTarget(null);
        }}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
