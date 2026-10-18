"use client";

import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { useMemo, useRef, useState } from "react";
import { BarChart3, Download, Printer } from "lucide-react";
import { useDine } from "@/lib/dine/store";
import { totalOutstanding } from "@/lib/dine/credit";
import { formatPaise } from "@/lib/dine/money";
import {
  billItemsCsv,
  billsCsv,
  downloadCsv,
  hourlySalesCsv,
  itemReportCsv,
  materialUsageCsv,
} from "@/lib/dine/csv";
import {
  businessDates,
  hourlySales,
  itemReport,
  materialUsage,
  summarise,
  taxSlabTotals,
} from "@/lib/dine/reports";
import { formatQty } from "@/lib/dine/units";
import {
  EmptyState,
  Field,
  Modal,
  SectionHeading,
  StatCard,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";
import { PREVIEW_CLASS, printNode, printedAt } from "./printing";

/**
 * Four numbers an owner wants at midnight, and nothing else. Every figure is
 * computed from the bills themselves rather than a running counter, so a report
 * cannot drift away from the bills it summarises (AC-6).
 */
export function ReportsScreen() {
  const { t } = useI18n();
  const {
    bills,
    billItems,
    billPayments,
    business,
    settings,
    todayDate,
    materials,
    stockMoves,
    ledgerEntries,
    reservations,
  } = useDine();
  const currency = business?.currency ?? "INR";

  const dates = useMemo(() => businessDates(bills), [bills]);
  const [from, setFrom] = useState(todayDate);
  const [to, setTo] = useState(todayDate);
  const [zOpen, setZOpen] = useState(false);

  const ranged = useMemo(
    () => bills.filter((bill) => bill.businessDate >= from && bill.businessDate <= to),
    [bills, from, to]
  );
  const rangedIds = useMemo(() => new Set(ranged.map((bill) => bill.id)), [ranged]);
  const rangedItems = useMemo(
    () => billItems.filter((item) => rangedIds.has(item.billId)),
    [billItems, rangedIds]
  );
  const rangedPayments = useMemo(
    () => billPayments.filter((payment) => rangedIds.has(payment.billId)),
    [billPayments, rangedIds]
  );

  const summary = useMemo(
    () => summarise(ranged, rangedPayments, rangedItems, from === to ? from : ""),
    [from, ranged, rangedItems, rangedPayments, to]
  );
  const items = useMemo(() => itemReport(ranged, rangedItems), [ranged, rangedItems]);
  const hourly = useMemo(() => hourlySales(ranged), [ranged]);
  const busiestHour = hourly.reduce((best, row) => (row.revenue > best.revenue ? row : best), hourly[0]);
  const usage = useMemo(
    () => (settings.inventoryEnabled ? materialUsage(stockMoves, materials, from, to) : []),
    [from, materials, settings.inventoryEnabled, stockMoves, to]
  );
  const soldCost = useMemo(() => items.reduce((sum, row) => sum + row.cost, 0), [items]);
  const soldRevenue = useMemo(() => items.reduce((sum, row) => sum + row.revenue, 0), [items]);

  if (bills.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-6 w-6" />}
        title={t("dnRpNoSales")}
        message={t("dnRpNoSalesBody")}
      />
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeading
        title={t("clNavReports")}
        subtitle={
          from === to
            ? fill(t("dnRpBusinessDay"), { date: from })
            : fill(t("dnRpRangeSubtitle"), {
                from,
                to,
                bills: fill(t(ranged.length === 1 ? "dnRpBill1" : "dnRpBillN"), {
                  n: ranged.length,
                }),
              })
        }
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setZOpen(true)} className={secondaryBtnClass}>
              <Printer className="h-4 w-4" />
              {t("dnRpDayClose")}
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(`bills-${from}-to-${to}.csv`, billsCsv(ranged))}
              className={secondaryBtnClass}
            >
              <Download className="h-4 w-4" />
              {t("clBkBills")}
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("clRpFrom")}>
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t("clRpTo")}>
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="flex gap-1 pb-0.5">
          <button
            type="button"
            onClick={() => {
              setFrom(todayDate);
              setTo(todayDate);
            }}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted hover:bg-white"
          >
            Today
          </button>
          {dates.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setFrom(dates[dates.length - 1]);
                setTo(dates[0]);
              }}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted hover:bg-white"
            >
              All time
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("bvaCatSales")}
          value={formatPaise(summary.totalSales, currency)}
          sub={fill(t(summary.billCount === 1 ? "dnRpBill1" : "dnRpBillN"), { n: summary.billCount })}
        />
        <StatCard
          label={t("dnRpAverageBill")}
          value={formatPaise(summary.averageBill, currency)}
          sub={fill(t("dnRpItemsServed"), { n: summary.guestCount })}
        />
        <StatCard
          label={t("dnRpTaxCollected")}
          value={formatPaise(summary.taxCollected, currency)}
          sub={
            summary.serviceCharge > 0
              ? fill(t("dnRpPlusService"), { amount: formatPaise(summary.serviceCharge, currency) })
              : undefined
          }
        />
        <StatCard
          label={t("dnRpDiscountsGiven")}
          value={formatPaise(summary.discountsGiven, currency)}
          sub={
            summary.cancelledCount > 0
              ? fill(t("dnRpCancelledSummary"), {
                  n: summary.cancelledCount,
                  amount: formatPaise(summary.cancelledValue, currency),
                })
              : t("dnRpNoCancellations")
          }
        />
      </div>

      {(settings.creditEnabled || settings.reservationsEnabled) && (
        <div className="rounded-2xl border border-muted-line/30 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-ink">{t("dnRpNotInDrawer")}</h3>
          <p className="mt-1 text-xs text-muted">
            Sales above count every bill in full, however it was settled. These two are what has
            been promised rather than paid, and what has been paid for meals not yet eaten — neither
            belongs in a day&apos;s takings.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {settings.creditEnabled && (
              <StatCard
                label={t("dnRpOwedOnAccount")}
                value={formatPaise(totalOutstanding(ledgerEntries), currency)}
                sub={t("dnRpInLedger")}
              />
            )}
            {settings.reservationsEnabled && (
              <StatCard
                label={t("dnRpAdvancesHeld")}
                value={formatPaise(
                  reservations
                    .filter((row) => row.status === "booked")
                    .reduce((sum, row) => sum + row.depositPaid, 0),
                  currency
                )}
                sub={t("dnRpAgainstBookings")}
              />
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-muted-line/30 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-ink">{t("dnRpByPaymentMethod")}</h3>
          {summary.byPaymentMethod.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{t("dnRpNothingSettled")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {summary.byPaymentMethod.map((row) => (
                <li key={row.methodName} className="flex items-center justify-between text-sm">
                  <span className="text-muted">
                    {row.methodName}
                    <span className="ml-1.5 text-xs">({row.count})</span>
                  </span>
                  <span className="font-bold text-ink">{formatPaise(row.amount, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-muted-line/30 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">{t("dnRpHourlySales")}</h3>
            <button
              type="button"
              onClick={() => downloadCsv(`hourly-${from}.csv`, hourlySalesCsv(hourly))}
              className="text-xs font-semibold text-indigo"
            >
              Export
            </button>
          </div>
          {busiestHour && busiestHour.revenue > 0 && (
            <p className="mt-1 text-xs text-muted">
              Busiest hour: {String(busiestHour.hour).padStart(2, "0")}:00 —{" "}
              {formatPaise(busiestHour.revenue, currency)}
            </p>
          )}
          <div className="mt-3 flex h-28 items-end gap-0.5">
            {hourly.map((row) => {
              const peak = busiestHour?.revenue || 1;
              const height = Math.round((row.revenue / peak) * 100);
              return (
                <div
                  key={row.hour}
                  className="group relative flex-1"
                  title={fill(t("dnRpHourTooltip"), {
                    hour: String(row.hour).padStart(2, "0"),
                    amount: formatPaise(row.revenue, currency),
                  })}
                >
                  <div
                    className="w-full rounded-t bg-indigo/70 transition group-hover:bg-indigo"
                    style={{ height: `${Math.max(height, row.revenue > 0 ? 4 : 1)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted">
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>23</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-muted-line/30 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-ink">{t("dnRpWhatSold")}</h3>
            <p className="text-xs text-muted">
              Quantity and revenue per dish — the input for menu engineering.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => downloadCsv(`items-${from}.csv`, itemReportCsv(items))}
              className="text-xs font-semibold text-indigo"
            >
              Export
            </button>
            <button
              type="button"
              onClick={() =>
                downloadCsv(`bill-items-${from}.csv`, billItemsCsv(ranged, rangedItems))
              }
              className="text-xs font-semibold text-indigo"
            >
              Line detail
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("dnRpNothingSold")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-muted-line/20 text-left">
                  <th className="py-2 font-semibold text-muted">{t("dnRpColDish")}</th>
                  <th className="py-2 text-right font-semibold text-muted">{t("dnBvQty")}</th>
                  <th className="py-2 text-right font-semibold text-muted">{t("dnRpColRevenue")}</th>
                  {soldCost > 0 && (
                    <>
                      <th className="py-2 text-right font-semibold text-muted">{t("dnRpColCost")}</th>
                      <th className="py-2 text-right font-semibold text-muted">{t("dnRpColMargin")}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.name} className="border-b border-muted-line/10 last:border-0">
                    <td className="py-2 text-ink">{row.name}</td>
                    <td className="py-2 text-right text-muted">{row.quantity}</td>
                    <td className="py-2 text-right font-semibold text-ink">
                      {formatPaise(row.revenue, currency)}
                    </td>
                    {soldCost > 0 && (
                      <>
                        <td className="py-2 text-right text-muted">
                          {row.cost > 0 ? formatPaise(row.cost, currency) : "—"}
                        </td>
                        <td className="py-2 text-right font-semibold text-ink">
                          {row.cost > 0
                            ? `${formatPaise(row.revenue - row.cost, currency)} (${Math.round(
                                ((row.revenue - row.cost) / Math.max(row.revenue, 1)) * 100
                              )}%)`
                            : "—"}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {settings.inventoryEnabled && (
        <div className="rounded-2xl border border-muted-line/30 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-ink">{t("dnRpKitchenGotThrough")}</h3>
              <p className="text-xs text-muted">
                Read from the stock ledger, not from the recipes — so a short stock take shows up
                as a variance instead of quietly disappearing.
              </p>
            </div>
            <button
              type="button"
              disabled={usage.length === 0}
              onClick={() => downloadCsv(`material-usage-${from}.csv`, materialUsageCsv(usage))}
              className="text-xs font-semibold text-indigo disabled:opacity-40"
            >
              Export
            </button>
          </div>

          {soldCost > 0 && (
            <p className="mt-2 text-sm text-ink">
              Food cost on what sold:{" "}
              <strong>
                {formatPaise(soldCost, currency)} of {formatPaise(soldRevenue, currency)} (
                {Math.round((soldCost / Math.max(soldRevenue, 1)) * 100)}%)
              </strong>
            </p>
          )}

          {usage.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Nothing moved in this range. Give your dishes recipes on the Menu screen and stock
              will start coming out as rounds are sent.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-muted-line/20 text-left">
                    <th className="py-2 font-semibold text-muted">{t("dnRcMaterial")}</th>
                    <th className="py-2 text-right font-semibold text-muted">{t("dnRpColUsed")}</th>
                    <th className="py-2 text-right font-semibold text-muted">{t("dnRpColWasted")}</th>
                    <th className="py-2 text-right font-semibold text-muted">{t("dnRpColReceived")}</th>
                    <th className="py-2 text-right font-semibold text-muted">{t("dnSmAdjust")}</th>
                    <th className="py-2 text-right font-semibold text-muted">{t("dnRpColCost")}</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((row) => (
                    <tr key={row.materialId} className="border-b border-muted-line/10 last:border-0">
                      <td className="py-2 text-ink">{row.name}</td>
                      <td className="py-2 text-right text-muted">
                        {row.used > 0 ? formatQty(row.used, row.unit) : "—"}
                      </td>
                      <td
                        className={`py-2 text-right ${row.wasted > 0 ? "font-semibold text-red-600" : "text-muted"}`}
                      >
                        {row.wasted > 0 ? formatQty(row.wasted, row.unit) : "—"}
                      </td>
                      <td className="py-2 text-right text-muted">
                        {row.received > 0 ? formatQty(row.received, row.unit) : "—"}
                      </td>
                      <td
                        className={`py-2 text-right ${
                          row.variance < 0 ? "font-semibold text-red-600" : "text-muted"
                        }`}
                      >
                        {row.variance !== 0
                          ? `${row.variance > 0 ? "+" : "−"}${formatQty(Math.abs(row.variance), row.unit)}`
                          : "—"}
                      </td>
                      <td className="py-2 text-right font-semibold text-ink">
                        {formatPaise(row.cost, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ZReportModal
        open={zOpen}
        onClose={() => setZOpen(false)}
        from={from}
        to={to}
        bills={ranged}
      />
    </div>
  );

  function ZReportModal({
    open,
    onClose,
    from: rangeFrom,
    to: rangeTo,
    bills: rangeBills,
  }: {
    open: boolean;
    onClose: () => void;
    from: string;
    to: string;
    bills: typeof bills;
  }) {
    const printRef = useRef<HTMLDivElement>(null);
    const slabs = taxSlabTotals(rangeBills);
    const money = (paise: number) => formatPaise(paise, currency).replace(/^[^\d-]+/, "");

    return (
      <Modal open={open} onClose={onClose} title={t("dnRpDayClose")}>
        <div className={`rounded-xl border border-muted-line/40 p-4 ${PREVIEW_CLASS}`}>
          <div ref={printRef}>
            <div className="c">
              <p className="lg b" style={{ margin: 0 }}>
                {business?.name ?? t("dnRestaurantFallback")}
              </p>
              <p className="b" style={{ margin: "2px 0 0" }}>
                {t("dnRpDayCloseCaps")}
              </p>
              <p className="sm" style={{ margin: 0 }}>
                {rangeFrom === rangeTo ? rangeFrom : `${rangeFrom} → ${rangeTo}`}
              </p>
              <p className="sm" style={{ margin: 0 }}>
                Printed {printedAt(new Date().toISOString())}
              </p>
            </div>

            <div className="solid" />
            <div className="row">
              <span>{t("dnRpBillsSettled")}</span>
              <span className="b">{summary.billCount}</span>
            </div>
            <div className="row">
              <span>{t("dnRpGrossSales")}</span>
              <span className="b">{money(summary.totalSales)}</span>
            </div>
            <div className="row">
              <span>{t("dnRpAverageBill")}</span>
              <span>{money(summary.averageBill)}</span>
            </div>
            <div className="row">
              <span>{t("dnRpDiscountsGiven")}</span>
              <span>− {money(summary.discountsGiven)}</span>
            </div>
            {summary.serviceCharge > 0 && (
              <div className="row">
                <span>{t("dnStServiceCharge")}</span>
                <span>{money(summary.serviceCharge)}</span>
              </div>
            )}

            <div className="rule" />
            <p className="b sm" style={{ margin: 0 }}>
              TAX
            </p>
            {slabs.map((slab) => (
              <div key={slab.rate}>
                <div className="row sm">
                  <span>
                    CGST {(slab.rate / 2).toFixed(2)}% on {money(slab.taxable)}
                  </span>
                  <span>{money(slab.cgst)}</span>
                </div>
                <div className="row sm">
                  <span>
                    SGST {(slab.rate / 2).toFixed(2)}% on {money(slab.taxable)}
                  </span>
                  <span>{money(slab.sgst)}</span>
                </div>
              </div>
            ))}
            <div className="row">
              <span className="b">{t("dnRpTotalTax")}</span>
              <span className="b">{money(summary.taxCollected)}</span>
            </div>

            <div className="rule" />
            <p className="b sm" style={{ margin: 0 }}>
              {t("dnRpPaymentsCaps")}
            </p>
            {summary.byPaymentMethod.map((row) => (
              <div className="row" key={row.methodName}>
                <span>
                  {row.methodName} ({row.count})
                </span>
                <span>{money(row.amount)}</span>
              </div>
            ))}

            {summary.cancelledCount > 0 && (
              <>
                <div className="rule" />
                <div className="row sm">
                  <span>{t("dnRpCancelledBills")}</span>
                  <span>
                    {summary.cancelledCount} · {money(summary.cancelledValue)}
                  </span>
                </div>
              </>
            )}

            <div className="solid" />
            <div className="row xl b">
              <span>{t("dnRpNet")}</span>
              <span>{money(summary.totalSales)}</span>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted">
          This is a summary, not a lock — nothing is closed off and you can reprint it any time.
        </p>

        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Close
          </button>
          <button
            type="button"
            onClick={() => printNode(printRef.current, settings.billPaperSize, t("dnRpDayClose"))}
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
