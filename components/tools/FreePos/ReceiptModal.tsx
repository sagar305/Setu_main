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

      {items.map((item) => (
        <div key={item.id} style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 12 }}>{item.name}</div>
          <div style={row("", "")}>
            <span>
              {item.quantity}
              {item.unit ? ` ${item.unit}` : ""} × {formatMoney(item.price, currency)}
            </span>
            <span>{formatMoney(item.lineSubtotal, currency)}</span>
          </div>
        </div>
      ))}

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

/** Print the receipt through a hidden iframe so only the receipt prints. */
function printReceipt(receiptEl: HTMLElement, paperSize: ReceiptPaperSize) {
  const paper = PAPER_CONFIG[paperSize] ?? PAPER_CONFIG["80mm"];

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  // Give the iframe the real content width so the height we measure below
  // matches the printed layout; keep it invisible.
  iframe.style.width = `${Math.ceil(paper.contentWidthMm * MM_TO_PX)}px`;
  iframe.style.height = "10px";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(
    `<!doctype html><html><head><title>Receipt</title><style>
      html, body { margin: 0; padding: 0; }
      body > div {
        box-sizing: border-box;
        width: ${paper.contentWidthMm}mm !important;
        max-width: ${paper.contentWidthMm}mm !important;
        margin: 0 auto !important;
      }
    </style></head><body>${receiptEl.outerHTML}</body></html>`
  );
  doc.close();

  const cleanup = () => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  };
  iframe.onload = () => {
    try {
      // Measure the laid-out receipt and size the page to match, so thermal
      // printers feed exactly one receipt length instead of an A4 sheet.
      const contentHeightPx = Math.max(
        doc.body.scrollHeight,
        doc.documentElement.scrollHeight
      );
      const pageStyle = doc.createElement("style");
      if (paper.pageWidthMm) {
        const heightMm = Math.ceil(contentHeightPx / MM_TO_PX) + 8;
        pageStyle.textContent = `@page { size: ${paper.pageWidthMm}mm ${heightMm}mm; margin: 0; }`;
      } else {
        pageStyle.textContent = `@page { size: A4; margin: 12mm; }`;
      }
      doc.head.appendChild(pageStyle);

      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      // Give the print dialog time to grab the document before removal.
      setTimeout(cleanup, 60000);
    }
  };
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
          onClick={() => receiptRef.current && printReceipt(receiptRef.current, paperSize)}
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
