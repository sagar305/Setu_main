"use client";

// Reports.
//
// Utilisation is first and everything else is below it, because it is the only
// report here that changes what the owner buys next. The rest answer questions
// they already know they have.

import { useMemo, useState } from "react";
import { Download, TrendingUp } from "lucide-react";
import { formatMoney } from "@/lib/pos/types";
import { useRental } from "@/lib/rental/store";
import {
  conversion,
  customerRanking,
  damageAndLoss,
  depositRegister,
  lateReturns,
  maintenanceByItem,
  totalsByMonth,
  tradeVsRetail,
  utilisationByItem,
} from "@/lib/rental/reports";
import {
  bookingsCsv,
  bookingLinesCsv,
  customersCsv,
  downloadCsv,
  itemsCsv,
  maintenanceSpendCsv,
  monthlyCsv,
  utilisationCsv,
} from "@/lib/rental/csv";
import { addDays, formatDate } from "@/lib/rental/types";
import { EmptyState, SectionCard, StatCard, chipBtnClass, inputClass } from "./ui";

export function ReportsScreen() {
  const {
    bookings,
    business,
    categories,
    customers,
    items,
    maintenanceLogs,
    settings,
    today,
  } = useRental();

  const [from, setFrom] = useState(() => addDays(today, -89));
  const [to, setTo] = useState(today);

  const currency = business?.currency ?? "INR";
  const period = useMemo(() => ({ from, to }), [from, to]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const utilisation = useMemo(
    () => utilisationByItem(items, bookings, maintenanceLogs, period, settings),
    [bookings, items, maintenanceLogs, period, settings]
  );
  const months = useMemo(() => totalsByMonth(bookings, settings), [bookings, settings]);
  const funnel = useMemo(() => conversion(bookings), [bookings]);
  const losses = useMemo(() => damageAndLoss(bookings, itemById), [bookings, itemById]);
  const late = useMemo(() => lateReturns(bookings), [bookings]);
  const ranking = useMemo(
    () => customerRanking(customers, bookings, settings),
    [bookings, customers, settings]
  );
  const split = useMemo(
    () => tradeVsRetail(customers, bookings, settings),
    [bookings, customers, settings]
  );
  const maintenance = useMemo(
    () => maintenanceByItem(maintenanceLogs, itemById, period),
    [itemById, maintenanceLogs, period]
  );
  const deposits = useMemo(() => depositRegister(bookings), [bookings]);
  const depositTotal = deposits.reduce((sum, booking) => sum + booking.depositTotal, 0);

  const money = (value: number) => formatMoney(value, currency);
  const plural = (count: number, noun: string) =>
    `${count} ${noun}${count === 1 ? "" : "s"}`;

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={<TrendingUp className="h-6 w-6" />}
        title="Nothing to report yet"
        message="Once bookings go out and come back, this is where utilisation, revenue and losses live."
      />
    );
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-muted-line/30 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr,1fr,auto] sm:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              From
            </span>
            <input
              type="date"
              className={inputClass}
              value={from}
              onChange={(event) => {
                const next = event.target.value;
                setFrom(next);
                if (to < next) setTo(next);
              }}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              To
            </span>
            <input
              type="date"
              className={inputClass}
              value={to}
              min={from}
              onChange={(event) => {
                const next = event.target.value;
                setTo(next);
                if (next < from) setFrom(next);
              }}
            />
          </label>
          <div className="flex gap-1.5">
            <button
              type="button"
              className={chipBtnClass}
              onClick={() => {
                setFrom(addDays(today, -29));
                setTo(today);
              }}
            >
              30 days
            </button>
            <button
              type="button"
              className={chipBtnClass}
              onClick={() => {
                setFrom(addDays(today, -364));
                setTo(today);
              }}
            >
              1 year
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Enquiry → confirmed"
          value={`${Math.round(funnel.rate * 100)}%`}
          sub={`${funnel.converted} of ${funnel.enquiries + funnel.converted + funnel.cancelled}`}
        />
        <StatCard
          label="Late returns"
          value={`${Math.round(late.lateRate * 100)}%`}
          sub={`${plural(late.lateBookings, "booking")} · ${money(late.lateFeesCharged)} charged`}
        />
        <StatCard
          label="Damage & loss recovered"
          value={money(losses.damageCharged + losses.lossCharged)}
          sub={losses.writtenOff ? `${money(losses.writtenOff)} written off` : "nothing written off"}
        />
        <StatCard
          label="Deposits held"
          value={money(depositTotal)}
          sub={plural(deposits.length, "booking")}
        />
      </div>

      <SectionCard
        title="Utilisation per item"
        action={
          <button
            type="button"
            onClick={() => downloadCsv("utilisation.csv", utilisationCsv(utilisation))}
            className={chipBtnClass}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV
          </button>
        }
      >
        <p className="mb-3 text-xs text-muted">
          Unit-days out divided by unit-days owned, over the period. What to buy more of is at
          the top; what to sell off is at the bottom.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-muted-line/30 text-left text-xs uppercase text-muted">
                <th className="py-2 pr-3 font-semibold">Item</th>
                <th className="py-2 pr-3 text-right font-semibold">Owned</th>
                <th className="py-2 pr-3 text-right font-semibold">Utilisation</th>
                <th className="py-2 pr-3 text-right font-semibold">Revenue</th>
                <th className="py-2 text-right font-semibold">Return on cost</th>
              </tr>
            </thead>
            <tbody>
              {utilisation.map((row) => (
                <tr key={row.item.id} className="border-b border-muted-line/20">
                  <td className="py-2 pr-3 text-ink">{row.item.name}</td>
                  <td className="py-2 pr-3 text-right text-muted">{row.item.totalQuantity}</td>
                  <td className="py-2 pr-3 text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted-line/25 sm:block">
                        <span
                          className="block h-full rounded-full bg-indigo"
                          style={{ width: `${Math.min(100, Math.round(row.utilisation * 100))}%` }}
                        />
                      </span>
                      <span className="font-semibold text-ink">
                        {Math.round(row.utilisation * 100)}%
                      </span>
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right text-ink">{money(row.revenue)}</td>
                  <td className="py-2 text-right text-muted">
                    {row.returnOnCost === null ? "—" : `${Math.round(row.returnOnCost * 100)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Bookings & revenue by month"
          action={
            <button
              type="button"
              onClick={() => downloadCsv("monthly.csv", monthlyCsv(months))}
              className={chipBtnClass}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              CSV
            </button>
          }
        >
          <div className="space-y-1.5">
            {months.slice(-12).map((month) => {
              const peak = Math.max(...months.map((row) => row.revenue), 1);
              return (
                <div key={month.month} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-muted">{month.month}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted-line/20">
                    <span
                      className="block h-full rounded-full bg-indigo"
                      style={{ width: `${Math.round((month.revenue / peak) * 100)}%` }}
                    />
                  </span>
                  <span className="w-24 shrink-0 text-right text-xs font-semibold text-ink">
                    {money(month.revenue)}
                  </span>
                  <span className="w-8 shrink-0 text-right text-xs text-muted">
                    {month.bookings}
                  </span>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="Customers by revenue"
          action={
            <button
              type="button"
              onClick={() => downloadCsv("customers.csv", customersCsv(ranking))}
              className={chipBtnClass}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              CSV
            </button>
          }
        >
          <p className="mb-2 text-xs text-muted">
            Trade {plural(split.trade, "booking")} · {money(split.tradeRevenue)} — retail{" "}
            {plural(split.retail, "booking")} · {money(split.retailRevenue)}
          </p>
          <div className="space-y-1">
            {ranking.slice(0, 10).map((row) => (
              <div key={row.customer.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm text-ink">
                  {row.customer.name}
                  {row.customer.isTrade ? (
                    <span className="ml-1.5 text-xs text-muted">trade</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-sm font-semibold text-ink">
                  {money(row.revenue)}
                  {row.outstanding > 0 ? (
                    <span className="ml-2 text-xs font-normal text-red-600">
                      {money(row.outstanding)} due
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Deposits currently held">
          {deposits.length === 0 ? (
            <p className="text-sm text-muted">Nothing held right now.</p>
          ) : (
            <div className="space-y-1">
              {deposits.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-ink">
                    {booking.bookingNo}
                    <span className="ml-2 text-xs text-muted">
                      due {formatDate(booking.toDate)}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-ink">
                    {money(booking.depositTotal)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Maintenance spend"
          action={
            <button
              type="button"
              onClick={() => downloadCsv("maintenance.csv", maintenanceSpendCsv(maintenance))}
              className={chipBtnClass}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              CSV
            </button>
          }
        >
          {maintenance.length === 0 ? (
            <p className="text-sm text-muted">Nothing logged in this period.</p>
          ) : (
            <div className="space-y-1">
              {maintenance.map((row) => (
                <div
                  key={row.item?.id ?? "unknown"}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="min-w-0 truncate text-ink">{row.item?.name ?? "—"}</span>
                  <span className="shrink-0 text-ink">
                    {money(row.cost)}
                    <span className="ml-2 text-xs text-muted">{row.entries} entries</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Export everything">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadCsv("bookings.csv", bookingsCsv(bookings, customers))}
            className={chipBtnClass}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Bookings
          </button>
          <button
            type="button"
            onClick={() => downloadCsv("booking-lines.csv", bookingLinesCsv(bookings, customers))}
            className={chipBtnClass}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Booking lines
          </button>
          <button
            type="button"
            onClick={() => downloadCsv("items.csv", itemsCsv(items, categories))}
            className={chipBtnClass}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Items
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
