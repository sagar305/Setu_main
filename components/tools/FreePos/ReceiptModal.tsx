"use client";

import { forwardRef, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import { usePos } from "@/lib/pos/store";
import { formatMoney, type Order, type OrderItem } from "@/lib/pos/types";
import { exportReceiptToPdf } from "@/lib/pos/receiptPdf";
import { Modal, primaryBtnClass, secondaryBtnClass } from "./ui";

// The receipt is styled with inline styles only (no Tailwind classes) so it
// can be copied into a print iframe and captured by html2canvas as-is.
const mono = "'Courier New', ui-monospace, Menlo, monospace";

const line: React.CSSProperties = {
  borderTop: "1px dashed #9ca3af",
  margin: "8px 0",
};

export const ReceiptView = forwardRef<
  HTMLDivElement,
  { order: Order; items: OrderItem[] }
>(function ReceiptView({ order, items }, ref) {
  const { business, settings } = usePos();
  const currency = business?.currency ?? "INR";

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
        <div style={{ fontSize: 16, fontWeight: 700 }}>{business?.name ?? "Receipt"}</div>
        {settings.showBusinessInfoOnReceipt && (
          <div style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>
            {business?.address && <div>{business.address}</div>}
            {business?.phone && <div>Ph: {business.phone}</div>}
            {business?.taxNumber && <div>Tax No: {business.taxNumber}</div>}
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
      <div style={{ ...row("", "", true), marginTop: 4 }}>
        <span>TOTAL</span>
        <span>{formatMoney(order.total, currency)}</span>
      </div>
      <div style={row("", "")}>
        <span>Paid via</span>
        <span>{order.paymentMethodName}</span>
      </div>

      <div style={line} />

      <div style={{ textAlign: "center", fontSize: 11, whiteSpace: "pre-wrap" }}>
        {settings.receiptFooter || "Thank you!"}
      </div>
    </div>
  );
});

/** Print the receipt through a hidden iframe so only the receipt prints. */
function printReceipt(receiptEl: HTMLElement) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(
    `<!doctype html><html><head><title>Receipt</title><style>@page{margin:6mm}body{margin:0}</style></head><body>${receiptEl.outerHTML}</body></html>`
  );
  doc.close();

  const cleanup = () => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  };
  iframe.onload = () => {
    try {
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
  const { orderItems } = usePos();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  if (!order) return null;
  const items = orderItems.filter((item) => item.orderId === order.id);

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    setError("");
    setDownloading(true);
    try {
      await exportReceiptToPdf(receiptRef.current, order.invoiceNumber);
    } catch {
      setError("Could not generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="rounded-xl border border-muted-line/30 bg-cream-paper p-4">
        <ReceiptView ref={receiptRef} order={order} items={items} />
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => receiptRef.current && printReceipt(receiptRef.current)}
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
      </div>
    </Modal>
  );
}
