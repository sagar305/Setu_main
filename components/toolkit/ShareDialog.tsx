"use client";

// Reusable share sheet for a SharedDoc. Builds the /view link, offers WhatsApp
// (to the customer's number when known), copy, and native share, and shows a
// QR of the link. A UPI ID can be overridden here (and optionally saved as the
// business default), and appointments can carry an optional advance fee.

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Modal, primaryBtnClass, secondaryBtnClass } from "@/components/tools/FreePos/ui";
import {
  buildShareUrl,
  docTitle,
  payableAmount,
  recipientPhone,
  type SharedDoc,
} from "@/lib/toolkit/shareLink";
import { formatMoney } from "@/lib/pos/types";
import { getWhatsAppShareUrl, shareViaWeb, canShare } from "@/lib/share";
import { isValidUPIId, supportsUpi } from "@/lib/upi";

function withOverrides(doc: SharedDoc, upiId: string, fee: number | null): SharedDoc {
  const b = { ...doc.b, u: upiId.trim() || undefined };
  if (doc.t === "apt") return { ...doc, b, fee: fee ?? doc.fee };
  return { ...doc, b };
}

export function ShareDialog({
  open,
  onClose,
  doc,
  title,
  allowFee = false,
  onSaveUpiDefault,
}: {
  open: boolean;
  onClose: () => void;
  doc: SharedDoc | null;
  title?: string;
  /** Show an advance/booking-fee input (appointments). */
  allowFee?: boolean;
  /** Called when the user opts to save an entered UPI as the business default. */
  onSaveUpiDefault?: (upiId: string) => void;
}) {
  const [upiId, setUpiId] = useState("");
  const [fee, setFee] = useState<string>("");
  const [saveDefault, setSaveDefault] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState("");

  useEffect(() => {
    if (doc && open) {
      setUpiId(doc.b.u ?? "");
      setFee(doc.t === "apt" && doc.fee ? String(doc.fee) : "");
      setSaveDefault(false);
      setCopied(false);
    }
  }, [doc, open]);

  const effectiveDoc = useMemo(
    () => (doc ? withOverrides(doc, upiId, fee ? Number(fee) : null) : null),
    [doc, upiId, fee]
  );

  const url = useMemo(() => {
    if (!effectiveDoc || typeof window === "undefined") return "";
    return buildShareUrl(effectiveDoc, window.location.origin);
  }, [effectiveDoc]);

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 200, margin: 1 }).then(setQr).catch(() => setQr(""));
  }, [url]);

  if (!doc || !effectiveDoc) return null;

  const amount = payableAmount(effectiveDoc);
  const currency = doc.b.cur;
  const phone = recipientPhone(effectiveDoc);
  const longLink = url.length > 1800;

  const message = [
    `${docTitle(effectiveDoc)} from ${doc.b.n}`,
    amount > 0 ? `Amount: ${formatMoney(amount, currency)}` : "",
    "",
    url,
  ]
    .filter((l) => l !== "" || true)
    .join("\n")
    .replace(/\n\n\n+/g, "\n\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the user can still long-press the field.
    }
  };

  const persistUpiIfAsked = () => {
    if (saveDefault && upiId.trim() && isValidUPIId(upiId.trim()) && onSaveUpiDefault) {
      onSaveUpiDefault(upiId.trim());
    }
  };

  const onWhatsApp = () => {
    persistUpiIfAsked();
    window.open(getWhatsAppShareUrl(message, phone?.replace(/\D/g, "") || undefined), "_blank");
  };

  const onNativeShare = async () => {
    persistUpiIfAsked();
    await shareViaWeb({ title: docTitle(effectiveDoc), text: message });
  };

  // UPI is an India/INR rail; only offer the payment setup for INR documents.
  const upiEnabled = supportsUpi(currency);

  return (
    <Modal open={open} onClose={onClose} title={title ?? "Share"}>
      <div className="space-y-4">
        {/* Payment setup — INR only */}
        {upiEnabled ? (
        <div className="rounded-lg border border-muted-line/30 p-3">
          <label className="block text-sm font-semibold text-ink">
            UPI ID for payment {amount > 0 ? "" : "(optional)"}
          </label>
          <input
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="shopname@okhdfcbank"
            className="mt-1 w-full rounded-lg border border-muted-line/40 px-3 py-2 text-sm outline-none focus:border-indigo"
          />
          {upiId.trim() && !isValidUPIId(upiId.trim()) ? (
            <p className="mt-1 text-xs text-amber-600">
              This doesn&apos;t look like a valid UPI ID — the pay button may not work.
            </p>
          ) : null}
          {onSaveUpiDefault && upiId.trim() && upiId.trim() !== (doc.b.u ?? "") ? (
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={saveDefault}
                onChange={(e) => setSaveDefault(e.target.checked)}
                className="h-4 w-4 accent-indigo"
              />
              Save as my default UPI ID
            </label>
          ) : null}

          {allowFee ? (
            <div className="mt-3">
              <label className="block text-sm font-semibold text-ink">
                Advance / booking fee (optional)
              </label>
              <input
                type="number"
                min={0}
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-muted-line/40 px-3 py-2 text-sm outline-none focus:border-indigo"
              />
            </div>
          ) : null}
        </div>
        ) : null}

        {/* Link + QR */}
        <div className="flex items-center gap-3">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Link QR" className="h-24 w-24 shrink-0 rounded-lg border border-muted-line/30 bg-white p-1" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Shareable link</p>
            <p className="mt-1 break-all rounded-lg bg-cream-paper/60 p-2 text-xs text-ink">{url}</p>
            {longLink ? (
              <p className="mt-1 text-xs text-amber-600">
                This link is long — some apps may trim it. Remove a few line items if it fails.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onWhatsApp} className={`${primaryBtnClass} flex-1`}>
            WhatsApp{phone ? " to customer" : ""}
          </button>
          <button type="button" onClick={copy} className={`${secondaryBtnClass} flex-1`}>
            {copied ? "Copied ✓" : "Copy link"}
          </button>
          {canShare() ? (
            <button type="button" onClick={onNativeShare} className={`${secondaryBtnClass} flex-1`}>
              Share…
            </button>
          ) : null}
        </div>

        <p className="text-xs text-muted">
          The whole document travels inside the link — nothing is uploaded. The recipient can view it
          and pay by UPI without any app or login.
        </p>
      </div>
    </Modal>
  );
}
