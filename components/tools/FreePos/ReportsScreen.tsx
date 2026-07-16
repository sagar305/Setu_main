"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { usePos } from "@/lib/pos/store";
import { formatMoney } from "@/lib/pos/types";
import {
  customersCsv,
  downloadCsv,
  inventoryCsv,
  ordersCsv,
  productsCsv,
  salesReportCsv,
} from "@/lib/pos/csv";
import { StatCard, inputClass, secondaryBtnClass } from "./ui";

type RangeId = "today" | "yesterday" | "week" | "month" | "custom";

const RANGES: { id: RangeId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toInputDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ReportsScreen() {
  const { business, products, categories, customers, orders, orderItems, inventoryLogs } =
    usePos();
  const currency = business?.currency ?? "INR";

  const [range, setRange] = useState<RangeId>("today");
  const [customFrom, setCustomFrom] = useState(toInputDate(new Date()));
  const [customTo, setCustomTo] = useState(toInputDate(new Date()));

  // Upper bounds are exclusive day boundaries (not "now") so the screen can
  // stay mounted while new sales come in and still count them.
  const { from, to } = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const tomorrowStart = new Date(todayStart.getTime() + 86400000);
    switch (range) {
      case "today":
        return { from: todayStart, to: tomorrowStart };
      case "yesterday": {
        const start = new Date(todayStart.getTime() - 86400000);
        return { from: start, to: todayStart };
      }
      case "week":
        return { from: new Date(todayStart.getTime() - 6 * 86400000), to: tomorrowStart };
      case "month":
        return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: tomorrowStart };
      case "custom": {
        const start = customFrom ? startOfDay(new Date(customFrom)) : todayStart;
        const end = customTo
          ? new Date(startOfDay(new Date(customTo)).getTime() + 86400000)
          : tomorrowStart;
        return { from: start, to: end };
      }
    }
  }, [range, customFrom, customTo]);

  const rangeOrders = useMemo(
    () =>
      orders.filter((order) => {
        const date = new Date(order.date);
        return order.status === "completed" && date >= from && date < to;
      }),
    [orders, from, to]
  );

  const totals = useMemo(() => {
    const sales = rangeOrders.reduce((sum, o) => sum + o.total, 0);
    return {
      sales,
      count: rangeOrders.length,
      average: rangeOrders.length ? sales / rangeOrders.length : 0,
    };
  }, [rangeOrders]);

  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const order of rangeOrders) {
      const entry = map.get(order.paymentMethodName) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += order.total;
      map.set(order.paymentMethodName, entry);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [rangeOrders]);

  const bestSellers = useMemo(() => {
    const orderIds = new Set(rangeOrders.map((o) => o.id));
    const map = new Map<string, { quantity: number; revenue: number }>();
    for (const item of orderItems) {
      if (!orderIds.has(item.orderId)) continue;
      const entry = map.get(item.name) ?? { quantity: 0, revenue: 0 };
      entry.quantity += item.quantity;
      entry.revenue += item.lineSubtotal;
      map.set(item.name, entry);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].quantity - a[1].quantity)
      .slice(0, 10);
  }, [rangeOrders, orderItems]);

  const stockStatus = useMemo(() => {
    const tracked = products.filter((p) => p.trackStock);
    return {
      tracked: tracked.length,
      low: tracked.filter((p) => p.stock > 0 && p.stock <= 5),
      out: tracked.filter((p) => p.stock <= 0),
    };
  }, [products]);

  const exports = [
    { label: "Products.csv", run: () => downloadCsv("Products.csv", productsCsv(products, categories)) },
    { label: "Customers.csv", run: () => downloadCsv("Customers.csv", customersCsv(customers)) },
    { label: "Orders.csv", run: () => downloadCsv("Orders.csv", ordersCsv(orders)) },
    {
      label: "Sales_Report.csv",
      run: () => downloadCsv("Sales_Report.csv", salesReportCsv(rangeOrders, orderItems)),
    },
    { label: "Inventory.csv", run: () => downloadCsv("Inventory.csv", inventoryCsv(inventoryLogs)) },
  ];

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                range === r.id
                  ? "bg-indigo text-white"
                  : "border border-muted-line/40 bg-white text-muted hover:text-indigo"
              }`}
            >
              {r.label}
            </button>
          ))}
          {range === "custom" && (
            <span className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(event) => setCustomFrom(event.target.value)}
                className={`${inputClass} w-auto`}
                aria-label="From date"
              />
              <span className="text-xs text-muted">to</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(event) => setCustomTo(event.target.value)}
                className={`${inputClass} w-auto`}
                aria-label="To date"
              />
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total Sales" value={formatMoney(totals.sales, currency)} />
          <StatCard label="Orders" value={String(totals.count)} />
          <StatCard label="Avg Order Value" value={formatMoney(totals.average, currency)} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-muted-line/30 bg-white p-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
            Payment breakdown
          </h3>
          {paymentBreakdown.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No sales in this period.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {paymentBreakdown.map(([name, entry]) => (
                <li key={name} className="flex items-center justify-between text-sm">
                  <span className="text-ink">
                    {name} <span className="text-xs text-muted">({entry.count})</span>
                  </span>
                  <span className="font-semibold text-ink">
                    {formatMoney(entry.total, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-muted-line/30 bg-white p-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
            Best-selling products
          </h3>
          {bestSellers.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No sales in this period.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {bestSellers.map(([name, entry]) => (
                <li key={name} className="flex items-center justify-between text-sm">
                  <span className="min-w-0 truncate text-ink">{name}</span>
                  <span className="shrink-0 pl-3 text-muted">
                    {entry.quantity} sold ·{" "}
                    <span className="font-semibold text-ink">
                      {formatMoney(entry.revenue, currency)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-muted-line/30 bg-white p-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Stock status</h3>
        {stockStatus.tracked === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No products track stock yet. Enable &ldquo;Track stock&rdquo; on a product to see it
            here.
          </p>
        ) : (
          <div className="mt-3 space-y-3 text-sm">
            <p className="text-muted">
              Tracking <strong className="text-ink">{stockStatus.tracked}</strong> products ·{" "}
              <strong className="text-saffron">{stockStatus.low.length}</strong> low stock ·{" "}
              <strong className="text-red-500">{stockStatus.out.length}</strong> out of stock
            </p>
            {[...stockStatus.out, ...stockStatus.low].length > 0 && (
              <ul className="space-y-1.5">
                {[...stockStatus.out, ...stockStatus.low].map((product) => (
                  <li key={product.id} className="flex items-center justify-between">
                    <span className="text-ink">{product.name}</span>
                    <span
                      className={`font-semibold ${
                        product.stock <= 0 ? "text-red-500" : "text-saffron"
                      }`}
                    >
                      {product.stock <= 0 ? "Out of stock" : `${product.stock} left`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-muted-line/30 bg-white p-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Export data (CSV)</h3>
        <p className="mt-1 text-xs text-muted">
          Sales_Report.csv uses the date range selected above; other exports include everything.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {exports.map((exp) => (
            <button key={exp.label} type="button" onClick={exp.run} className={secondaryBtnClass}>
              <Download className="h-4 w-4" />
              {exp.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
