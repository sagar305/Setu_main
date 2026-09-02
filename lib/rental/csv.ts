// CSV exports for the rental book.
//
// The Reports screen answers the questions we anticipated; this is for the ones
// we did not. One row per booking, one per line and one per item, from which
// every summary on that screen can be rebuilt in a spreadsheet.

export { toCsv, downloadCsv } from "@/lib/pos/csv";

import { toCsv } from "@/lib/pos/csv";
import type {
  CustomerRank,
  ItemUtilisation,
  MaintenanceSpend,
  MonthTotals,
} from "./reports";
import {
  BOOKING_STATUS_LABELS,
  MAINTENANCE_KIND_LABELS,
  RATE_BASIS_LABELS,
  type Booking,
  type Customer,
  type ItemCategory,
  type MaintenanceLog,
  type RentalItem,
} from "./types";

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function bookingsCsv(bookings: Booking[], customers: Customer[]): string {
  const nameOf = (id: string) => customers.find((c) => c.id === id)?.name ?? "";
  const header = [
    "Booking no",
    "Status",
    "Customer",
    "Event",
    "Venue",
    "From",
    "To",
    "Returned on",
    "Items",
    "Rent total",
    "Deposit",
    "Advance",
    "Late days",
    "Late fee",
    "Damage",
    "Loss",
    "Paid",
    "Deposit refunded",
    "Balance payable",
    "Invoice no",
    "Note",
  ];
  const body = bookings.map((booking) => [
    booking.bookingNo,
    BOOKING_STATUS_LABELS[booking.status],
    nameOf(booking.customerId),
    booking.eventName,
    booking.venue,
    booking.fromDate,
    booking.toDate,
    booking.actualReturnedOn ?? "",
    booking.lines.reduce((sum, line) => sum + line.quantity, 0),
    booking.total,
    booking.depositTotal,
    booking.advancePaid,
    booking.lateDays || "",
    booking.lateFee || "",
    booking.damageTotal || "",
    booking.lossTotal || "",
    booking.paid,
    booking.depositRefunded || "",
    booking.finalPayable || "",
    booking.invoiceNo ?? "",
    booking.note,
  ]);
  return toCsv(header, body);
}

/** One row per line on every booking — the export everything rebuilds from. */
export function bookingLinesCsv(bookings: Booking[], customers: Customer[]): string {
  const nameOf = (id: string) => customers.find((c) => c.id === id)?.name ?? "";
  const header = [
    "Booking no",
    "Status",
    "Customer",
    "From",
    "To",
    "Item",
    "Qty",
    "Rate",
    "Basis",
    "Chargeable units",
    "Amount",
    "Deposit/unit",
    "Returned",
    "Damaged",
    "Lost",
    "Damage charge",
    "Loss charge",
    "Return note",
  ];
  const body = bookings.flatMap((booking) =>
    booking.lines.map((line) => [
      booking.bookingNo,
      BOOKING_STATUS_LABELS[booking.status],
      nameOf(booking.customerId),
      booking.fromDate,
      booking.toDate,
      line.name,
      line.quantity,
      line.rate,
      RATE_BASIS_LABELS[line.rateBasis],
      line.chargeableUnits,
      line.amount,
      line.depositPerUnit,
      line.returnedQuantity || "",
      line.damagedQuantity || "",
      line.lostQuantity || "",
      line.damageCharge || "",
      line.lossCharge || "",
      line.returnNote,
    ])
  );
  return toCsv(header, body);
}

export function itemsCsv(items: RentalItem[], categories: ItemCategory[]): string {
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";
  const header = [
    "Item",
    "Category",
    "Tracking",
    "Total quantity",
    "Rate",
    "Basis",
    "Deposit/unit",
    "Late fee/unit/day",
    "Replacement value",
    "Purchase cost",
    "Purchased on",
    "Active",
    "Notes",
  ];
  const body = items.map((item) => [
    item.name,
    categoryName(item.categoryId),
    item.tracking,
    item.totalQuantity,
    item.rate,
    RATE_BASIS_LABELS[item.rateBasis],
    item.depositPerUnit,
    item.lateFeePerUnitPerDay,
    item.replacementValue,
    item.purchaseCost,
    item.purchasedOn,
    item.active ? "Yes" : "No",
    item.notes,
  ]);
  return toCsv(header, body);
}

export function utilisationCsv(rows: ItemUtilisation[]): string {
  const header = [
    "Item",
    "Owned",
    "Unit-days out",
    "Unit-days available",
    "Utilisation",
    "Revenue",
    "Bookings",
    "Purchase cost",
    "Return on cost",
    "Maintenance spend",
  ];
  const body = rows.map((row) => [
    row.item.name,
    row.item.totalQuantity,
    row.unitDaysOut,
    row.unitDaysAvailable,
    percent(row.utilisation),
    row.revenue,
    row.bookings,
    row.purchaseCost || "",
    row.returnOnCost === null ? "" : percent(row.returnOnCost),
    row.maintenanceSpend || "",
  ]);
  return toCsv(header, body);
}

export function monthlyCsv(rows: MonthTotals[]): string {
  const header = ["Month", "Bookings", "Revenue", "Deposits taken", "Late fees", "Damage & loss"];
  const body = rows.map((row) => [
    row.month,
    row.bookings,
    row.revenue,
    row.deposits,
    row.lateFees,
    row.damageAndLoss,
  ]);
  return toCsv(header, body);
}

export function customersCsv(rows: CustomerRank[]): string {
  const header = ["Customer", "Phone", "Trade", "Bookings", "Revenue", "Outstanding"];
  const body = rows.map((row) => [
    row.customer.name,
    row.customer.phone,
    row.customer.isTrade ? "Yes" : "",
    row.bookings,
    row.revenue,
    row.outstanding || "",
  ]);
  return toCsv(header, body);
}

export function maintenanceCsv(logs: MaintenanceLog[], items: RentalItem[]): string {
  const nameOf = (id: string) => items.find((item) => item.id === id)?.name ?? "";
  const header = [
    "Date",
    "Item",
    "Kind",
    "Quantity",
    "Description",
    "Cost",
    "Out of service from",
    "Out of service to",
  ];
  const body = logs.map((log) => [
    log.date,
    nameOf(log.itemId),
    MAINTENANCE_KIND_LABELS[log.kind],
    log.quantity,
    log.description,
    log.cost,
    log.outOfServiceFrom ?? "",
    log.outOfServiceTo ?? "",
  ]);
  return toCsv(header, body);
}

export function maintenanceSpendCsv(rows: MaintenanceSpend[]): string {
  const header = ["Item", "Entries", "Cost"];
  const body = rows.map((row) => [row.item?.name ?? "—", row.entries, row.cost]);
  return toCsv(header, body);
}
