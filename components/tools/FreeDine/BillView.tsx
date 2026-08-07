"use client";

import { forwardRef } from "react";
import { formatPaise, amountInWords, toMajor } from "@/lib/dine/money";
import {
  ORDER_TYPE_LABELS,
  type DineBill,
  type DineBillItem,
  type DineBillPayment,
  type DineBusiness,
  type DineSettings,
} from "@/lib/dine/types";
import { printedAt } from "./printing";

/**
 * The guest's bill. Printed to a thermal roll or A4, and captured as a PDF by
 * the same markup, so what a guest is handed and what they are emailed cannot
 * drift apart.
 *
 * The GST breakup prints per slab with CGST and SGST split out, because a bill
 * that shows only a single "tax" line is not a tax invoice — a guest claiming
 * input credit needs the rate and the halves.
 */
export const BillView = forwardRef<
  HTMLDivElement,
  {
    bill: DineBill;
    items: DineBillItem[];
    payments: DineBillPayment[];
    business: DineBusiness | null;
    settings: DineSettings;
  }
>(function BillView({ bill, items, payments, business, settings }, ref) {
  const currency = business?.currency ?? "INR";
  const money = (paise: number) => formatPaise(paise, currency).replace(/^[^\d-]+/, "");
  const showItems = items.length > 0;

  return (
    <div ref={ref}>
      {settings.showBusinessInfoOnBill && (
        <div className="c">
          <p className="lg b" style={{ margin: 0 }}>
            {business?.name ?? "Restaurant"}
          </p>
          {business?.address && (
            <p className="sm" style={{ margin: "2px 0 0" }}>
              {business.address}
            </p>
          )}
          {business?.phone && (
            <p className="sm" style={{ margin: 0 }}>
              {business.phone}
            </p>
          )}
          {business?.gstin && (
            <p className="sm b" style={{ margin: "2px 0 0" }}>
              GSTIN: {business.gstin}
            </p>
          )}
        </div>
      )}

      <div className="rule" />

      <div className="row">
        <span className="b">{bill.billLabel}</span>
        <span className="sm">{printedAt(bill.createdAt)}</span>
      </div>
      <div className="row sm">
        <span>
          {bill.tableName
            ? `${bill.tableName}${bill.areaName ? ` · ${bill.areaName}` : ""}`
            : ORDER_TYPE_LABELS[bill.orderType]}
        </span>
        {bill.splitCount > 1 && (
          <span className="b">
            Split {bill.splitIndex} of {bill.splitCount}
          </span>
        )}
      </div>
      {bill.customerName && (
        <p className="sm" style={{ margin: 0 }}>
          {bill.customerName}
        </p>
      )}
      {bill.status === "cancelled" && (
        <p className="b c xl" style={{ margin: "4px 0" }}>
          ** CANCELLED **
        </p>
      )}

      <div className="solid" />

      {showItems ? (
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }} className="sm">
                Item
              </th>
              <th className="sm c" style={{ width: "12mm" }}>
                Qty
              </th>
              <th className="sm r" style={{ width: "18mm" }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {items
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((item) => (
                <tr key={item.id}>
                  <td className="wrap">
                    {item.name}
                    {item.variationName ? ` (${item.variationName})` : ""}
                    {item.modifiers.length > 0 && (
                      <div className="sm">+ {item.modifiers.map((m) => m.name).join(", ")}</div>
                    )}
                  </td>
                  <td className="c">{item.quantity}</td>
                  <td className="r">{money(item.lineTotal)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : (
        <p className="sm">
          Share of the table&apos;s bill ({bill.splitIndex} of {bill.splitCount}).
        </p>
      )}

      <div className="rule" />

      <div className="row">
        <span>Subtotal</span>
        <span>{money(bill.subtotal)}</span>
      </div>
      {bill.discountAmount > 0 && (
        <div className="row">
          <span>
            Discount
            {bill.discountType === "percent" && bill.discountValue > 0
              ? ` (${bill.discountValue}%)`
              : ""}
          </span>
          <span>− {money(bill.discountAmount)}</span>
        </div>
      )}
      {bill.serviceCharge > 0 && (
        <div className="row">
          <span>Service charge ({bill.serviceChargeRate}%)</span>
          <span>{money(bill.serviceCharge)}</span>
        </div>
      )}

      {bill.taxBreakup.length > 0 && (
        <>
          <div className="rule" />
          {bill.taxBreakup.map((slab) => (
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
        </>
      )}

      <div className="solid" />
      <div className="row xl b">
        <span>TOTAL</span>
        <span>{money(bill.total)}</span>
      </div>
      {bill.includedTax > 0 && (
        <p className="sm" style={{ margin: "2px 0 0" }}>
          (Includes {money(bill.includedTax)} tax)
        </p>
      )}
      <p className="sm" style={{ margin: "4px 0 0" }}>
        {amountInWords(bill.total, currency)}
      </p>

      {payments.length > 0 && (
        <>
          <div className="rule" />
          {payments.map((payment) => (
            <div className="row sm" key={payment.id}>
              <span>{payment.methodName}</span>
              <span>{money(payment.amount)}</span>
            </div>
          ))}
        </>
      )}

      {business?.upiId && (
        <p className="c sm" style={{ margin: "6px 0 0" }}>
          Pay by UPI: {business.upiId}
        </p>
      )}

      <div className="rule" />
      <p className="c sm" style={{ margin: 0 }}>
        {settings.receiptFooter}
      </p>
      {bill.serviceCharge > 0 && (
        <p className="c sm" style={{ margin: "4px 0 0" }}>
          Service charge is voluntary. Ask us to remove it if you prefer.
        </p>
      )}
    </div>
  );
});

/** Plain-text summary for sharing over WhatsApp where files are unsupported. */
export function billShareText(
  bill: DineBill,
  business: DineBusiness | null,
  currency: string
): string {
  const lines = [
    business?.name ?? "Restaurant",
    `Bill ${bill.billLabel}`,
    bill.tableName ? `Table ${bill.tableName}` : ORDER_TYPE_LABELS[bill.orderType],
    `Total: ${currency === "INR" ? "₹" : ""}${toMajor(bill.total).toFixed(2)}`,
    printedAt(bill.createdAt),
  ];
  return lines.filter(Boolean).join("\n");
}
