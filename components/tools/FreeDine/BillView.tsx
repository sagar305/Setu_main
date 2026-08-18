"use client";

import { forwardRef, useEffect, useState } from "react";
import { formatPaise, amountInWords, toMajor } from "@/lib/dine/money";
import {
  ORDER_TYPE_LABELS,
  type DineBill,
  type DineBillItem,
  type DineBillPayment,
  type DineBusiness,
  type DineSettings,
} from "@/lib/dine/types";
import type { ReceiptTemplate } from "@/lib/toolkit/types";
import { getReceiptTemplates } from "@/lib/toolkit/workspace";
import { useDine } from "@/lib/dine/store";
import { printedAt } from "./printing";

/**
 * The bill layout chosen in Settings, designed in the Receipt Designer.
 *
 * Templates live in the shared workspace rather than in Free Dine's own
 * database — they are a toolkit tool's output, like the Customer Ledger's
 * contacts, so a restaurant designs one look and uses it across the tools.
 * Returns null when none is chosen or the workspace cannot be read, and the
 * built-in layout takes over.
 */
export function useBillTemplate(): ReceiptTemplate | null {
  const { settings } = useDine();
  const templateId = settings.billTemplateId;
  const [template, setTemplate] = useState<ReceiptTemplate | null>(null);

  useEffect(() => {
    if (!templateId) {
      setTemplate(null);
      return;
    }
    let cancelled = false;
    getReceiptTemplates()
      .then((all) => {
        if (!cancelled) setTemplate(all.find((row) => row.id === templateId) ?? null);
      })
      .catch(() => {
        // A missing workspace just means the built-in layout.
      });
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  return template;
}

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
    /** A layout designed in the Receipt Designer; null = the built-in one. */
    template?: ReceiptTemplate | null;
  }
>(function BillView({ bill, items, payments, business, settings, template }, ref) {
  const currency = business?.currency ?? "INR";
  const money = (paise: number) => formatPaise(paise, currency).replace(/^[^\d-]+/, "");
  const showItems = items.length > 0;

  // A designed template wins over the built-in defaults, field by field, so a
  // restaurant that only changed the footer keeps everything else.
  const accent = template?.accentColor || "#000000";
  const showBusiness = template ? template.showBusinessInfo : settings.showBusinessInfoOnBill;
  const showGstin = template ? template.showGstin : true;
  const showLogo = template ? template.showLogo : false;
  const footerText = template?.footerText || settings.receiptFooter;
  const headerText = template?.headerText ?? "";
  const boldTotals = template ? template.boldTotals : true;

  // "none" still needs the vertical rhythm a rule was giving, or the sections
  // run together into one block of text.
  const separator = template?.separator ?? "dashed";
  const Rule = ({ strong }: { strong?: boolean }) => {
    if (separator === "none") return <div style={{ height: "4px" }} />;
    if (separator === "solid" || strong) return <div className="solid" style={{ borderColor: accent }} />;
    return <div className="rule" style={{ borderColor: accent }} />;
  };

  return (
    <div ref={ref}>
      {showLogo && business?.logoDataUrl && (
        <div className="c">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={business.logoDataUrl}
            alt=""
            style={{ maxHeight: "18mm", maxWidth: "100%", margin: "0 auto 2mm" }}
          />
        </div>
      )}

      {showBusiness && (
        <div className="c">
          <p className="lg b" style={{ margin: 0, color: accent }}>
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
          {showGstin && business?.gstin && (
            <p className="sm b" style={{ margin: "2px 0 0" }}>
              GSTIN: {business.gstin}
            </p>
          )}
        </div>
      )}

      {headerText && (
        <p className="c sm" style={{ margin: "2px 0 0" }}>
          {headerText}
        </p>
      )}

      <Rule />

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

      <Rule strong />

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

      <Rule />

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
          <Rule />
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

      <Rule strong />
      <div className={`row xl ${boldTotals ? "b" : ""}`} style={{ color: accent }}>
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
          <Rule />
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

      <Rule />
      <p className="c sm" style={{ margin: 0 }}>
        {footerText}
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
