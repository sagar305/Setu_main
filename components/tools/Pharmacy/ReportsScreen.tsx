"use client";

import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { usePharmacy } from "@/lib/pharmacy/store";
import {
  customerDues,
  gstSummary,
  marginByMedicine,
  marginTotals,
  movers,
  reorderList,
  salesByDay,
  salesByMonth,
  salesByPaymentMode,
  scheduleRegister,
  supplierSummary,
  type DateRange,
} from "@/lib/pharmacy/reports";
import { stockValue } from "@/lib/pharmacy/calc";
import {
  downloadCsv,
  gstCsv,
  marginCsv,
  registerCsv,
  reorderCsv,
  salesByDayCsv,
  stockLogCsv,
  supplierCsv,
} from "@/lib/pharmacy/csv";
import { printScheduleRegister } from "@/lib/pharmacy/print";
import { formatMoney } from "@/lib/pos/types";
import {
  SCHEDULE_LABELS,
  STOCK_MOVEMENT_LABELS,
  addDays,
  formatDate,
  formatExpiry,
  todayKey,
  type ScheduleClass,
} from "@/lib/pharmacy/types";
import { Pill, StatCard, inputClass, secondaryBtnClass } from "./ui";

type TabId =
  | "sales"
  | "margin"
  | "movers"
  | "stock"
  | "register"
  | "gst"
  | "suppliers"
  | "ledger";

const TABS: { id: TabId; label: string }[] = [
  { id: "sales", label: "Sales" },
  { id: "margin", label: "Margin" },
  { id: "movers", label: "Movers" },
  { id: "stock", label: "Stock" },
  { id: "register", label: "Schedule register" },
  { id: "gst", label: "GST" },
  { id: "suppliers", label: "Suppliers" },
  { id: "ledger", label: "Stock ledger" },
];

export function ReportsScreen() {
  const {
    batches,
    business,
    customers,
    medicines,
    purchaseReturns,
    purchases,
    saleReturns,
    sales,
    settings,
    stockLogs,
    suppliers,
    today,
  } = usePharmacy();

  const [tab, setTab] = useState<TabId>("sales");
  const [from, setFrom] = useState(() => addDays(todayKey(), -30));
  const [to, setTo] = useState(() => todayKey());
  const [monthly, setMonthly] = useState(false);

  const currency = business?.currency ?? "INR";
  const range: DateRange = { from, to };

  const dayRows = useMemo(
    () => (monthly ? salesByMonth(sales, range) : salesByDay(sales, range)),
    [monthly, range, sales]
  );
  const modeRows = useMemo(() => salesByPaymentMode(sales, range), [range, sales]);
  const marginRows = useMemo(() => marginByMedicine(sales, batches, range), [batches, range, sales]);
  const totals = useMemo(() => marginTotals(marginRows), [marginRows]);
  const moverRows = useMemo(() => movers(sales, range), [range, sales]);
  const value = useMemo(() => stockValue(batches, today), [batches, today]);
  const reorder = useMemo(
    () => reorderList(medicines, batches, sales, settings, today),
    [batches, medicines, sales, settings, today]
  );
  const gstRows = useMemo(
    () => gstSummary(sales, range, settings.taxInclusive),
    [range, sales, settings.taxInclusive]
  );
  const registerRows = useMemo(
    () => scheduleRegister(sales, medicines, range, settings.prescriptionRequiredFor),
    [medicines, range, sales, settings.prescriptionRequiredFor]
  );
  const supplierRows = useMemo(
    () => supplierSummary(suppliers, purchases, purchaseReturns, range),
    [purchaseReturns, purchases, range, suppliers]
  );
  const dueRows = useMemo(
    () => customerDues(customers, sales, saleReturns),
    [customers, saleReturns, sales]
  );

  const salesTotal = dayRows.reduce((sum, row) => sum + row.total, 0);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs font-semibold text-muted">
          From
          <input
            type="date"
            className={inputClass}
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted">
          To
          <input
            type="date"
            className={inputClass}
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <div className="flex gap-1">
          {[
            { label: "7d", days: 7 },
            { label: "30d", days: 30 },
            { label: "90d", days: 90 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setTo(todayKey());
                setFrom(addDays(todayKey(), -preset.days));
              }}
              className="rounded-lg border border-muted-line/40 px-3 py-2 text-xs font-semibold text-muted hover:border-indigo/40 hover:text-indigo"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1" aria-label="Reports">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-current={tab === item.id ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === item.id ? "bg-indigo text-white" : "bg-white text-muted hover:text-indigo"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* ---------------------------------------------------------------- */}
      {tab === "sales" && (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Sales" value={formatMoney(salesTotal, currency)} />
            <StatCard
              label="Bills"
              value={String(dayRows.reduce((sum, row) => sum + row.bills, 0))}
            />
            <StatCard
              label="Average bill"
              value={formatMoney(
                dayRows.reduce((sum, row) => sum + row.bills, 0) > 0
                  ? salesTotal / dayRows.reduce((sum, row) => sum + row.bills, 0)
                  : 0,
                currency
              )}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setMonthly(false)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  monthly ? "text-muted" : "bg-indigo/10 text-indigo"
                }`}
              >
                By day
              </button>
              <button
                type="button"
                onClick={() => setMonthly(true)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  monthly ? "bg-indigo/10 text-indigo" : "text-muted"
                }`}
              >
                By month
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  `sales-by-${monthly ? "month" : "day"}.csv`,
                  salesByDayCsv(dayRows, monthly ? "Month" : "Date")
                )
              }
              className={secondaryBtnClass}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </button>
          </div>

          <ReportTable
            headers={["Date", "Bills", "Items", "Discount", "Tax", "Total"]}
            rows={dayRows.map((row) => [
              monthly ? row.date : formatDate(row.date),
              row.bills,
              row.items,
              formatMoney(row.discount, currency),
              formatMoney(row.tax, currency),
              formatMoney(row.total, currency),
            ])}
            empty="No sales in this period."
          />

          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
            By payment mode
          </h3>
          <ReportTable
            headers={["Mode", "Bills", "Billed", "Collected"]}
            rows={modeRows.map((row) => [
              row.mode,
              row.bills,
              formatMoney(row.total, currency),
              formatMoney(row.collected, currency),
            ])}
            empty="No sales in this period."
          />
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {tab === "margin" && (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label="Revenue" value={formatMoney(totals.revenue, currency)} />
            <StatCard label="Cost of goods" value={formatMoney(totals.cost, currency)} />
            <StatCard label="Margin" value={formatMoney(totals.margin, currency)} />
            <StatCard label="Margin %" value={`${totals.marginPct}%`} />
          </div>
          <p className="text-xs text-muted">
            Cost is taken from the batch each line actually sold from, blended over any scheme
            goods that came with it — so a strip bought on two invoices at two rates reports two
            different margins rather than an average that hides the bad one.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => downloadCsv("margin.csv", marginCsv(marginRows))}
              className={secondaryBtnClass}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </button>
          </div>
          <ReportTable
            headers={["Medicine", "Units", "Revenue", "Cost", "Margin", "Margin %"]}
            rows={marginRows.map((row) => [
              row.name,
              row.quantity,
              formatMoney(row.revenue, currency),
              formatMoney(row.cost, currency),
              formatMoney(row.margin, currency),
              `${row.marginPct}%`,
            ])}
            empty="No sales in this period."
          />
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {tab === "movers" && (
        <div className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
                Fastest moving
              </h3>
              <ReportTable
                headers={["Medicine", "Units", "Revenue"]}
                rows={moverRows
                  .slice(0, 15)
                  .map((row) => [row.name, row.quantity, formatMoney(row.revenue, currency)])}
                empty="No sales in this period."
              />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
                Slowest moving
              </h3>
              <ReportTable
                headers={["Medicine", "Units", "Revenue"]}
                rows={moverRows
                  .slice(-15)
                  .reverse()
                  .map((row) => [row.name, row.quantity, formatMoney(row.revenue, currency)])}
                empty="No sales in this period."
              />
            </div>
          </div>
          <p className="text-xs text-muted">
            Medicines with no sales at all in this window do not appear here — check the stock
            report for what is sitting still.
          </p>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {tab === "stock" && (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Stock at cost"
              value={formatMoney(value.atCost, currency)}
              sub="Sellable stock only"
            />
            <StatCard label="Stock at MRP" value={formatMoney(value.atMrp, currency)} />
            <StatCard
              label="Expired, still on shelf"
              value={formatMoney(value.expiredAtCost, currency)}
              sub="Not counted as stock value"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
              Suggested order, by supplier
            </h3>
            <button
              type="button"
              onClick={() => downloadCsv("reorder.csv", reorderCsv(reorder, suppliers))}
              className={secondaryBtnClass}
              disabled={reorder.length === 0}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </button>
          </div>
          <ReportTable
            headers={["Supplier", "Medicine", "In stock", "Low at", "Sold, 30d"]}
            rows={reorder.map((row) => [
              suppliers.find((supplier) => supplier.id === row.supplierId)?.name ?? "—",
              row.medicine.name,
              row.available,
              row.medicine.lowStockAt,
              row.soldLast30,
            ])}
            empty="Nothing is at or below its low-stock mark."
          />
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {tab === "register" && (
        <div className="grid gap-4">
          <div className="rounded-xl border border-saffron/50 bg-saffron/10 p-3 text-sm text-ink">
            This is a record built from your own bills, for your own use. It is{" "}
            <strong>not certified as a statutory register</strong> and does not replace any
            register you are required to keep under the Drugs and Cosmetics Rules. Rows where no
            prescription was captured appear with the doctor columns blank, so a gap is visible
            rather than hidden.
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              {registerRows.length} entr{registerRows.length === 1 ? "y" : "ies"} for{" "}
              {settings.prescriptionRequiredFor
                .map((schedule) => SCHEDULE_LABELS[schedule as ScheduleClass])
                .join(", ") || "no schedule classes"}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => printScheduleRegister(registerRows, range, business, settings)}
                className={secondaryBtnClass}
                disabled={registerRows.length === 0}
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Print
              </button>
              <button
                type="button"
                onClick={() => downloadCsv("schedule-register.csv", registerCsv(registerRows))}
                className={secondaryBtnClass}
                disabled={registerRows.length === 0}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Export
              </button>
            </div>
          </div>

          <ReportTable
            headers={[
              "Date",
              "Bill",
              "Patient",
              "Prescriber",
              "Medicine",
              "Batch",
              "Expiry",
              "Qty",
            ]}
            rows={registerRows.map((row) => [
              formatDate(row.date),
              row.invoiceNo,
              row.patientName || "—",
              row.doctorName ? `${row.doctorName} (${row.doctorRegNo || "no reg"})` : "—",
              `${row.medicine} · ${row.schedule}`,
              row.batchNo || "—",
              row.expiry,
              row.quantity,
            ])}
            empty="No scheduled sales in this period."
          />
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {tab === "gst" && (
        <div className="grid gap-4">
          <p className="text-xs text-muted">
            {settings.taxInclusive
              ? "Your prices include tax, so the taxable value here is backed out of what was charged."
              : "Your prices exclude tax, so the tax below was added on top of what was charged."}{" "}
            Rebuilt from each bill&rsquo;s own lines, so changing a tax setting today does not
            move a figure you have already filed against.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => downloadCsv("gst-summary.csv", gstCsv(gstRows))}
              className={secondaryBtnClass}
              disabled={gstRows.length === 0}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </button>
          </div>
          <ReportTable
            headers={["Rate", "Taxable value", "CGST", "SGST", "Total tax"]}
            rows={gstRows.map((row) => [
              `${row.rate}%`,
              formatMoney(row.taxable, currency),
              formatMoney(row.cgst, currency),
              formatMoney(row.sgst, currency),
              formatMoney(row.tax, currency),
            ])}
            empty="No sales in this period."
          />
          <p className="text-xs text-muted">
            Intra-state supply only — CGST and SGST at half the rate each. Inter-state sales
            (IGST) and a full HSN-wise summary are not produced here.
          </p>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {tab === "suppliers" && (
        <div className="grid gap-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => downloadCsv("suppliers.csv", supplierCsv(supplierRows))}
              className={secondaryBtnClass}
              disabled={supplierRows.length === 0}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </button>
          </div>
          <ReportTable
            headers={["Supplier", "Invoices", "Purchased", "Paid", "Returned", "Outstanding"]}
            rows={supplierRows.map((row) => [
              row.supplier?.name ?? "—",
              row.purchases,
              formatMoney(row.purchased, currency),
              formatMoney(row.paid, currency),
              formatMoney(row.returned, currency),
              formatMoney(row.outstanding, currency),
            ])}
            empty="No purchases in this period."
          />

          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
            Customer balances
          </h3>
          <ReportTable
            headers={["Customer", "Bills", "Billed", "Paid", "Returned", "Due"]}
            rows={dueRows
              .filter((row) => row.due > 0)
              .map((row) => [
                row.customer.name,
                row.bills,
                formatMoney(row.billed, currency),
                formatMoney(row.paid, currency),
                formatMoney(row.returned, currency),
                formatMoney(row.due, currency),
              ])}
            empty="Nobody owes anything."
          />
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {tab === "ledger" && (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              Every movement of every batch, newest first. Only sales, returns, purchases and
              explicit corrections can move stock, and each one writes a row here.
            </p>
            <button
              type="button"
              onClick={() => downloadCsv("stock-ledger.csv", stockLogCsv(stockLogs))}
              className={secondaryBtnClass}
              disabled={stockLogs.length === 0}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </button>
          </div>
          <ReportTable
            headers={["When", "Medicine", "Batch", "Expiry", "Movement", "Change", "After", "Note"]}
            rows={stockLogs
              .slice(0, 300)
              .map((row) => [
                formatDate(row.createdAt.slice(0, 10)),
                row.medicineName || "—",
                row.batchNo || "—",
                formatExpiry(row.expiry),
                STOCK_MOVEMENT_LABELS[row.type],
                <Pill key={row.id} tone={row.change > 0 ? "good" : "danger"}>
                  {row.change > 0 ? `+${row.change}` : row.change}
                </Pill>,
                row.quantityAfter,
                row.note || "—",
              ])}
            empty="No stock has moved yet."
          />
          {stockLogs.length > 300 && (
            <p className="text-xs text-muted">
              Showing the most recent 300 movements. Export for the full ledger.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ReportTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-muted-line/30 bg-white p-4 text-sm text-muted">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-muted-line/30 bg-white">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-cream-paper">
          <tr>
            {headers.map((header, index) => (
              <th
                key={header}
                className={`p-3 text-xs font-semibold uppercase tracking-wide text-muted ${
                  index > 0 ? "text-right" : ""
                }`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-muted-line/20">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`p-3 ${
                    cellIndex === 0 ? "font-semibold text-ink" : "text-right text-muted"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
