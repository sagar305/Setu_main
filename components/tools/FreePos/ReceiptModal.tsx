"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import { usePos } from "@/lib/pos/store";
import {
  formatMoney,
  type Order,
  type OrderItem,
  type ReceiptPaperSize,
} from "@/lib/pos/types";
import { exportReceiptToPdf } from "@/lib/pos/receiptPdf";
import { isHandheldDevice } from "@/lib/pos/device";
import { getReceiptTemplates } from "@/lib/toolkit/workspace";
import type { ReceiptTemplate } from "@/lib/toolkit/types";
import { ShareDialog } from "@/components/toolkit/ShareDialog";
import { businessToShare, type SharedDoc } from "@/lib/toolkit/shareLink";
import { Share2 } from "lucide-react";
import { Modal, primaryBtnClass, secondaryBtnClass } from "./ui";

// The receipt is styled with inline styles only (no Tailwind classes) so it
// can be copied into a print iframe and captured by html2canvas as-is.
const mono = "'Courier New', ui-monospace, Menlo, monospace";

function separatorStyle(kind: ReceiptTemplate["separator"] | undefined): React.CSSProperties {
  if (kind === "none") return { margin: "8px 0" };
  return {
    borderTop: `1px ${kind === "solid" ? "solid" : "dashed"} #9ca3af`,
    margin: "8px 0",
  };
}

export const ReceiptView = forwardRef<
  HTMLDivElement,
  { order: Order; items: OrderItem[]; template?: ReceiptTemplate | null }
>(function ReceiptView({ order, items, template }, ref) {
  const { business, settings } = usePos();
  const currency = business?.currency ?? "INR";

  // A saved Receipt Designer template overrides the POS's built-in look;
  // without one the receipt renders exactly as before.
  const line = separatorStyle(template?.separator);
  const accent = template?.accentColor || "#111111";
  const showBizInfo = template ? template.showBusinessInfo : settings.showBusinessInfoOnReceipt;
  const showGstin = template ? template.showGstin : true;
  const boldTotals = template ? template.boldTotals : true;
  const footerText = (template ? template.footerText : settings.receiptFooter) || "Thank you!";

  const row = (label: string, value: string, bold = false): React.CSSProperties => ({
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    fontWeight: bold ? 700 : 400,
    fontSize: bold ? 14 : 12,
  });

  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        maxWidth: 300,
        margin: "0 auto",
        background: "#ffffff",
        color: "#111111",
        fontFamily: mono,
        fontSize: 12,
        lineHeight: 1.5,
        padding: 16,
      }}
    >
      <div style={{ textAlign: "center" }}>
        {template?.headerText ? (
          <div style={{ fontSize: 12, fontWeight: 700, color: accent, letterSpacing: 1 }}>
            {template.headerText}
          </div>
        ) : null}
        {template?.showLogo && business?.logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={business.logoDataUrl}
            alt=""
            style={{ width: 44, height: 44, objectFit: "contain", margin: "4px auto" }}
          />
        ) : null}
        <div style={{ fontSize: 16, fontWeight: 700, color: template ? accent : undefined }}>
          {business?.name ?? "Receipt"}
        </div>
        {showBizInfo && (
          <div style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>
            {business?.address && <div>{business.address}</div>}
            {business?.phone && <div>Ph: {business.phone}</div>}
            {business?.taxNumber && showGstin && <div>Tax No: {business.taxNumber}</div>}
          </div>
        )}
      </div>

      <div style={line} />

      <div style={row("", "")}>
        <span>{order.invoiceNumber}</span>
        <span>{new Date(order.date).toLocaleString()}</span>
      </div>
      {order.customerName && <div style={{ fontSize: 12 }}>Customer: {order.customerName}</div>}
      {order.status === "cancelled" && (
        <div style={{ fontSize: 13, fontWeight: 700, textAlign: "center", color: "#b91c1c" }}>
          *** CANCELLED ***
        </div>
      )}

      <div style={line} />

      {items.map((item) => {
        // Show the unit only when it's a real unit of measure (kg, pcs…),
        // never a bare number — otherwise "1 × ₹100" reads as "1 100 × ₹100".
        const unitLabel =
          item.unit && !/^\d+(\.\d+)?$/.test(item.unit.trim()) ? ` ${item.unit.trim()}` : "";
        return (
          <div key={item.id} style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 12 }}>{item.name}</div>
            <div style={row("", "")}>
              <span>
                {item.quantity}
                {unitLabel} × {formatMoney(item.price, currency)}
              </span>
              <span>{formatMoney(item.lineSubtotal, currency)}</span>
            </div>
          </div>
        );
      })}

      <div style={line} />

      <div style={row("", "")}>
        <span>Subtotal</span>
        <span>{formatMoney(order.subtotal, currency)}</span>
      </div>
      {order.discountAmount > 0 && (
        <div style={row("", "")}>
          <span>
            Discount
            {order.discountType === "percent" ? ` (${order.discountValue}%)` : ""}
          </span>
          <span>-{formatMoney(order.discountAmount, currency)}</span>
        </div>
      )}
      {order.taxAmount > 0 && (
        <div style={row("", "")}>
          <span>Tax</span>
          <span>{formatMoney(order.taxAmount, currency)}</span>
        </div>
      )}
      {(order.includedTaxAmount ?? 0) > 0 && (
        <div style={row("", "")}>
          <span>Incl. tax</span>
          <span>{formatMoney(order.includedTaxAmount, currency)}</span>
        </div>
      )}
      <div style={{ ...row("", "", boldTotals), marginTop: 4 }}>
        <span>TOTAL</span>
        <span>{formatMoney(order.total, currency)}</span>
      </div>
      <div style={row("", "")}>
        <span>Paid via</span>
        <span>{order.paymentMethodName}</span>
      </div>

      <div style={line} />

      <div style={{ textAlign: "center", fontSize: 11, whiteSpace: "pre-wrap" }}>
        {footerText}
      </div>
    </div>
  );
});

// Printable content width per paper size. Thermal rolls get a page exactly
// as wide as the roll (with a small side gutter) and as tall as the receipt,
// so drivers like Epson TM-series print continuously instead of onto A4.
const PAPER_CONFIG: Record<ReceiptPaperSize, { pageWidthMm: number | null; contentWidthMm: number }> = {
  "80mm": { pageWidthMm: 80, contentWidthMm: 72 },
  "58mm": { pageWidthMm: 58, contentWidthMm: 52 },
  a4: { pageWidthMm: null, contentWidthMm: 76 },
};

const MM_TO_PX = 96 / 25.4;

type PaperConfig = (typeof PAPER_CONFIG)[ReceiptPaperSize];

/** What came of a print attempt — a blocked pop-up is worth telling the user about. */
type PrintOutcome = { ok: true } | { ok: false; message: string };

/**
 * The receipt as a document a printer can take: the receipt markup, the page
 * rules for the chosen roll, and a script that measures the laid-out receipt
 * and prints it. Thermal rolls get a page exactly one receipt long so drivers
 * feed the right amount of paper instead of an A4 sheet.
 *
 * `standalone` adds what a real browser tab needs and a hidden print iframe
 * must not have: a viewport, a page around the receipt, and buttons to print
 * again or close — a browser that ignores the automatic print() still leaves
 * the shopkeeper one tap away from printing.
 */
function receiptPrintDocument(
  receiptHtml: string,
  paper: PaperConfig,
  invoiceNumber: string,
  standalone: boolean
): string {
  const pageRule = paper.pageWidthMm
    ? ""
    : "@page { size: A4; margin: 12mm; }";

  const sizeScript = paper.pageWidthMm
    ? `var sheet = document.getElementById("receipt");
       var heightMm = Math.ceil(sheet.getBoundingClientRect().height / (96 / 25.4)) + 8;
       var style = document.createElement("style");
       style.textContent = "@page { size: ${paper.pageWidthMm}mm " + heightMm + "mm; margin: 0; }";
       document.head.appendChild(style);`
    : "";

  const chrome = standalone
    ? `<div class="toolbar">
         <button type="button" onclick="window.print()">Print receipt</button>
         <button type="button" class="ghost" onclick="window.close()">Close</button>
       </div>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8" />
    <title>Receipt ${escapeHtml(invoiceNumber)}</title>
    ${standalone ? '<meta name="viewport" content="width=device-width, initial-scale=1" />' : ""}
    <style>
      html, body { margin: 0; padding: 0; background: #ffffff; }
      #receipt {
        box-sizing: border-box;
        width: ${paper.contentWidthMm}mm;
        max-width: ${paper.contentWidthMm}mm;
        margin: 0 auto;
      }
      #receipt > div { width: 100% !important; max-width: 100% !important; }
      ${pageRule}
      ${
        standalone
          ? `html, body { min-height: 100%; background: #f4f1ea; }
             body { font-family: system-ui, -apple-system, sans-serif; }
             #receipt { background: #ffffff; padding: 8px 0; }
             .toolbar {
               position: sticky; bottom: 0; display: flex; gap: 10px; justify-content: center;
               padding: 14px; background: #f4f1ea;
             }
             .toolbar button {
               flex: 1 1 0; max-width: 220px; padding: 12px 16px; border-radius: 10px;
               border: 0; background: #3730a3; color: #ffffff; font-size: 15px; font-weight: 600;
             }
             .toolbar button.ghost { background: #ffffff; color: #111827; border: 1px solid #d1d5db; }
             @media print { .toolbar { display: none !important; } html, body { background: #ffffff; } }`
          : ""
      }
    </style></head>
    <body><div id="receipt">${receiptHtml}</div>${chrome}
    <script>
      window.addEventListener("load", function () {
        ${sizeScript}
        window.focus();
        // A beat for layout and fonts, so the preview is not a blank page.
        setTimeout(function () { window.print(); }, 100);
      });
    </script></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => {
    if (character === "&") return "&amp;";
    if (character === "<") return "&lt;";
    if (character === ">") return "&gt;";
    return "&quot;";
  });
}

/**
 * Print from a hidden iframe, so the page around the receipt never reaches the
 * printer. Desktop only: WebKit on iPhone and iPad ignores print() from a
 * subframe, which is why phones and tablets take the route below instead.
 */
function printFromIframe(html: string, paper: PaperConfig): PrintOutcome {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  // Give the iframe the real content width so the receipt lays out — and so
  // measures — exactly as it will print; keep it invisible.
  iframe.style.width = `${Math.ceil(paper.contentWidthMm * MM_TO_PX)}px`;
  iframe.style.height = "10px";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    return { ok: false, message: "Could not open the print view. Try Download PDF instead." };
  }
  doc.open();
  doc.write(html);
  doc.close();

  // Give the print dialog time to grab the document before removal.
  setTimeout(() => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }, 60000);
  return { ok: true };
}

/**
 * Print from a tab of its own. Phones and tablets need this: iOS Safari will
 * not print a hidden iframe, and an in-app browser may not print automatically
 * at all — in a tab the receipt is at least on screen with a Print button
 * under it, and the browser's own share sheet can reach the printer.
 */
function printFromTab(html: string): PrintOutcome {
  const tab = window.open("", "_blank");
  if (!tab) {
    return {
      ok: false,
      message:
        "Your browser blocked the print window. Allow pop-ups for this site, or use Download PDF.",
    };
  }
  tab.document.open();
  tab.document.write(html);
  tab.document.close();
  return { ok: true };
}

/** Print the receipt, the way this device can actually print. */
function printReceipt(
  receiptEl: HTMLElement,
  paperSize: ReceiptPaperSize,
  invoiceNumber: string
): PrintOutcome {
  const paper = PAPER_CONFIG[paperSize] ?? PAPER_CONFIG["80mm"];
  const handheld = isHandheldDevice();
  const html = receiptPrintDocument(receiptEl.outerHTML, paper, invoiceNumber, handheld);
  return handheld ? printFromTab(html) : printFromIframe(html, paper);
}

export function ReceiptModal({
  order,
  open,
  onClose,
  title = "Receipt",
}: {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  title?: string;
}) {
  const { orderItems, settings, business, customers, updateBusiness } = usePos();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [template, setTemplate] = useState<ReceiptTemplate | null>(null);
  const [sharing, setSharing] = useState<SharedDoc | null>(null);

  // Load the Receipt Designer template chosen in POS settings (if any).
  const templateId = settings.receiptTemplateId ?? "";
  useEffect(() => {
    if (!templateId) {
      setTemplate(null);
      return;
    }
    let cancelled = false;
    getReceiptTemplates()
      .then((all) => {
        if (!cancelled) setTemplate(all.find((t) => t.id === templateId) ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  if (!order) return null;
  const items = orderItems.filter((item) => item.orderId === order.id);
  const paperSize: ReceiptPaperSize = template?.paperSize ?? settings.receiptPaperSize ?? "80mm";

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    setError("");
    setDownloading(true);
    try {
      await exportReceiptToPdf(
        receiptRef.current,
        order.invoiceNumber,
        paperSize === "58mm" ? 58 : 80
      );
    } catch {
      setError("Could not generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const buildShare = (): SharedDoc => {
    const currency = business?.currency ?? "INR";
    const customerPhone = order.customerId
      ? customers.find((c) => c.id === order.customerId)?.phone
      : undefined;
    return {
      t: "inv",
      b: businessToShare(business, currency),
      no: order.invoiceNumber,
      dt: order.date,
      cn: order.customerName || undefined,
      cp: customerPhone || undefined,
      it: items.map((i) => ({
        n: i.name,
        q: i.quantity,
        r: i.price,
        x: i.taxRate || undefined,
      })),
      sub: order.subtotal,
      dis: order.discountAmount || undefined,
      tax: order.taxAmount || undefined,
      tot: order.total,
      pm: order.paymentMethodName || undefined,
    };
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="rounded-xl border border-muted-line/30 bg-cream-paper p-4">
        <ReceiptView ref={receiptRef} order={order} items={items} template={template} />
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            if (!receiptRef.current) return;
            const outcome = printReceipt(receiptRef.current, paperSize, order.invoiceNumber);
            setError(outcome.ok ? "" : outcome.message);
          }}
          className={`${primaryBtnClass} flex-1`}
        >
          <Printer className="h-4 w-4" />
          Print receipt
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className={`${secondaryBtnClass} flex-1`}
        >
          <Download className="h-4 w-4" />
          {downloading ? "Preparing…" : "Download PDF"}
        </button>
        <button
          type="button"
          onClick={() => setSharing(buildShare())}
          className={`${secondaryBtnClass} flex-1`}
        >
          <Share2 className="h-4 w-4" />
          Share link
        </button>
      </div>

      <ShareDialog
        open={sharing !== null}
        onClose={() => setSharing(null)}
        doc={sharing}
        title="Share invoice"
        onSaveUpiDefault={(upiId) => void updateBusiness({ upiId })}
      />
    </Modal>
  );
}
