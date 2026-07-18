"use client";

// Profit Dashboard — net profit from real data:
//   revenue (POS orders) − cost of goods (product costPrice) − expenses
// Orders/products come from the shared workspace (consent-gated);
// expenses come from the Expense Tracker's store.
// Chart palette (#4F46E5 revenue / #D97706 expenses) validated for CVD
// separation and contrast on the light surface.

import { useEffect, useMemo, useState } from "react";
import { Card, EmptyState, SecondaryButton, TextInput } from "@/components/toolkit/ui";
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useWorkspaceConnection } from "@/lib/hooks/useWorkspaceConnection";
import { getExpenses, getOrderItems, getOrders } from "@/lib/toolkit/workspace";
import type { Expense } from "@/lib/toolkit/types";
import type { Order, OrderItem } from "@/lib/pos/types";
import { formatMoney } from "@/lib/pos/types";

const REVENUE = "#4F46E5";
const EXPENSE = "#D97706";

type RangeKey = "today" | "7d" | "30d" | "custom";

const isoDay = (d: Date) => d.toISOString().split("T")[0];

function rangeDates(key: RangeKey, from: string, to: string): { start: string; end: string } {
  const today = isoDay(new Date());
  if (key === "today") return { start: today, end: today };
  if (key === "custom" && from && to) return { start: from, end: to };
  const days = key === "7d" ? 6 : 29;
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start: isoDay(start), end: today };
}

function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  const d = new Date(`${start}T00:00:00`);
  const stop = new Date(`${end}T00:00:00`);
  while (d <= stop && days.length < 366) {
    days.push(isoDay(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export function ProfitDashboardTool() {
  const workspace = useWorkspaceConnection("profit-dashboard");
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [range, setRange] = useState<RangeKey>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showTable, setShowTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    getExpenses().then(setExpenses).catch(() => {});
  }, []);

  useEffect(() => {
    if (workspace.connected) {
      getOrders().then(setOrders).catch(() => {});
      getOrderItems().then(setOrderItems).catch(() => {});
    }
  }, [workspace.connected]);

  const currency = workspace.business?.currency ?? "INR";
  const { start, end } = rangeDates(range, from, to);

  const costOf = useMemo(() => {
    const map = new Map(workspace.products.map((p) => [p.id, p.costPrice ?? 0]));
    return (item: OrderItem) => (item.productId ? (map.get(item.productId) ?? 0) : 0);
  }, [workspace.products]);

  const data = useMemo(() => {
    const days = eachDay(start, end);
    const inRange = (isoDate: string) => isoDate >= start && isoDate <= end;

    const completed = orders.filter((o) => o.status === "completed" && inRange(o.date.slice(0, 10)));
    const orderIds = new Set(completed.map((o) => o.id));
    const revenue = completed.reduce((s, o) => s + o.total, 0);
    const cogs = orderItems
      .filter((i) => orderIds.has(i.orderId))
      .reduce((s, i) => s + costOf(i) * i.quantity, 0);

    const expInRange = expenses.filter((e) => inRange(e.date));
    const expenseTotal = expInRange.reduce((s, e) => s + e.amount, 0);

    const daily = days.map((day) => ({
      day,
      revenue: completed
        .filter((o) => o.date.slice(0, 10) === day)
        .reduce((s, o) => s + o.total, 0),
      expenses: expInRange.filter((e) => e.date === day).reduce((s, e) => s + e.amount, 0),
    }));

    const byCategory = new Map<string, number>();
    for (const e of expInRange) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);

    return {
      revenue,
      cogs,
      grossProfit: revenue - cogs,
      expenseTotal,
      netProfit: revenue - cogs - expenseTotal,
      daily,
      byCategory: Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [orders, orderItems, expenses, start, end, costOf]);

  const hasAnyData = orders.length > 0 || expenses.length > 0;
  const maxDaily = Math.max(...data.daily.map((d) => d.revenue), 1);
  const maxCat = Math.max(...data.byCategory.map(([, v]) => v), 1);

  const tiles: { label: string; value: number; strong?: boolean }[] = [
    { label: "Revenue", value: data.revenue },
    { label: "Cost of goods", value: data.cogs },
    { label: "Gross profit", value: data.grossProfit },
    { label: "Expenses", value: data.expenseTotal },
    { label: "Net profit", value: data.netProfit, strong: true },
  ];

  return (
    <div>
      <WorkspaceBanner
        connection={workspace}
        message="Include your POS sales and product costs, so profit comes from real numbers."
      />

      {/* Filter row */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(
          [
            ["today", "Today"],
            ["7d", "Last 7 days"],
            ["30d", "Last 30 days"],
            ["custom", "Custom"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setRange(key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              range === key
                ? "bg-indigo text-white"
                : "border border-muted-line/40 text-ink hover:bg-cream-paper"
            }`}
          >
            {label}
          </button>
        ))}
        {range === "custom" ? (
          <span className="flex items-center gap-2">
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
            <span className="text-muted">to</span>
            <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          </span>
        ) : null}
      </div>

      {!hasAnyData ? (
        <EmptyState
          title="No data to chart yet"
          subtitle="Record sales in the Browser POS and expenses in the Expense Tracker — your profit appears here automatically, computed from real numbers."
          action={
            <>
              <a
                href="/products/browser-based-pos"
                className="rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo/90"
              >
                Open Browser POS
              </a>
              <a
                href="/tools/expense-tracker"
                className="rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
              >
                Open Expense Tracker
              </a>
            </>
          }
        />
      ) : (
        <>
          {/* Stat tiles */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {tiles.map((t) => (
              <Card key={t.label} className="!p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t.label}</p>
                <p
                  className={`mt-1 font-bold text-ink ${t.strong ? "text-2xl" : "text-lg"} ${
                    t.strong && data.netProfit < 0 ? "!text-red-600" : ""
                  }`}
                >
                  {formatMoney(t.value, currency)}
                </p>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Revenue by day — single-series bar chart */}
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-ink">Revenue by day</h2>
                <SecondaryButton onClick={() => setShowTable((v) => !v)}>
                  {showTable ? "View chart" : "View table"}
                </SecondaryButton>
              </div>

              {!workspace.connected ? (
                <p className="py-8 text-center text-sm text-muted">
                  Connect your workspace above to include POS sales.
                </p>
              ) : showTable ? (
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-muted-line/30 text-left text-muted">
                        <th className="py-1.5 pr-4 font-semibold">Day</th>
                        <th className="py-1.5 pr-4 text-right font-semibold">Revenue</th>
                        <th className="py-1.5 text-right font-semibold">Expenses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.daily.map((d) => (
                        <tr key={d.day} className="border-b border-muted-line/20">
                          <td className="py-1.5 pr-4 text-muted">{d.day}</td>
                          <td className="py-1.5 pr-4 text-right text-ink">
                            {formatMoney(d.revenue, currency)}
                          </td>
                          <td className="py-1.5 text-right text-ink">
                            {formatMoney(d.expenses, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="relative">
                  {hover !== null && data.daily[hover] ? (
                    <div
                      className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 rounded-lg bg-ink px-3 py-1.5 text-xs text-white shadow"
                      style={{ left: `${((hover + 0.5) / data.daily.length) * 100}%` }}
                    >
                      <span className="font-semibold">
                        {new Date(`${data.daily[hover].day}T00:00:00`).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      : {formatMoney(data.daily[hover].revenue, currency)}
                    </div>
                  ) : null}
                  <svg
                    viewBox={`0 0 ${data.daily.length * 20} 120`}
                    className="h-48 w-full"
                    role="img"
                    aria-label="Bar chart of revenue per day"
                    preserveAspectRatio="none"
                    onMouseLeave={() => setHover(null)}
                  >
                    {data.daily.map((d, i) => {
                      const h = Math.max((d.revenue / maxDaily) * 108, d.revenue > 0 ? 2 : 0);
                      return (
                        <g key={d.day} onMouseEnter={() => setHover(i)}>
                          {/* hit target wider than the mark */}
                          <rect x={i * 20} y={0} width={20} height={120} fill="transparent" />
                          <rect
                            x={i * 20 + 4}
                            y={120 - h}
                            width={12}
                            height={h}
                            rx={h > 4 ? 3 : 0}
                            fill={REVENUE}
                            opacity={hover === null || hover === i ? 1 : 0.45}
                          />
                        </g>
                      );
                    })}
                    <line x1="0" y1="119.5" x2={data.daily.length * 20} y2="119.5" stroke="#E5E3DC" />
                  </svg>
                  <div className="mt-1 flex justify-between text-xs text-muted">
                    <span>
                      {new Date(`${start}T00:00:00`).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <span>
                      {new Date(`${end}T00:00:00`).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                </div>
              )}
            </Card>

            {/* Expenses by category — horizontal bars */}
            <Card>
              <h2 className="mb-4 text-base font-bold text-ink">Expenses by category</h2>
              {data.byCategory.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">
                  No expenses in this period.{" "}
                  <a href="/tools/expense-tracker" className="font-semibold text-indigo">
                    Add them in the Expense Tracker
                  </a>
                  .
                </p>
              ) : (
                <div className="space-y-3">
                  {data.byCategory.map(([cat, total]) => (
                    <div key={cat}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-ink">{cat}</span>
                        <span className="text-muted">{formatMoney(total, currency)}</span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-cream-paper">
                        <div
                          className="h-3 rounded-full"
                          style={{ width: `${(total / maxCat) * 100}%`, backgroundColor: EXPENSE }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
