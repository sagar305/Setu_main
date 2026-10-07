"use client";

// Reusable share sheet for a SharedDoc. Builds the /view link, offers WhatsApp
// (to the customer's number when known), copy, and native share, and shows a
// QR of the link. A UPI ID can be overridden here (and optionally saved as the
// business default), and appointments can carry an optional advance fee.
//
// The link starts out self-contained: the whole document rides in the fragment
// and nothing is uploaded. Pressing "Shorten" stores the document with the
// shortener and swaps in a ten-character link. If that fails, or the browser is
// offline, the long link stays and the dialog says so instead of silently doing
// nothing. With the preference turned off, no part of this appears at all.
//
// A user who has turned on "shorten every link automatically" gets the same
// upload without the tap — the setting is the deliberate act, made once instead
// of per share. It is still one shorten per document, it still falls back to the
// long link on any failure, and the dialog still says which link is in hand.

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
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { getWhatsAppShareUrl, shareViaWeb, canShare } from "@/lib/share";
import { encodeDoc } from "@/lib/toolkit/shareLink";
import { useShortenLink } from "@/lib/toolkit/useShortenLink";
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
  recipientLabel,
  onSaveUpiDefault,
}: {
  open: boolean;
  onClose: () => void;
  doc: SharedDoc | null;
  title?: string;
  /** Show an advance/booking-fee input (appointments). */
  allowFee?: boolean;
  /** Who the link is going to — "parent" in the Tuition Class Manager.
   *  Already translated by the caller; defaults to "customer". */
  recipientLabel?: string;
  /** Called when the user opts to save an entered UPI as the business default. */
  onSaveUpiDefault?: (upiId: string) => void;
}) {
  const { t, lang } = useI18n();
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

  const shortener = useShortenLink();

  const longUrl = useMemo(() => {
    if (!effectiveDoc || typeof window === "undefined") return "";
    return buildShareUrl(effectiveDoc, window.location.origin);
  }, [effectiveDoc]);

  // A short code stands for one exact document. The moment the UPI ID or the
  // advance fee is edited it stands for the wrong one, so it is dropped and the
  // user shortens again if they still want to.
  const { reset, shorten, auto, status: shortenStatus } = shortener;
  useEffect(() => {
    reset();
  }, [longUrl, reset]);

  // Auto-shortening: do exactly what the button would do, once, as the sheet
  // opens. `reset` above has already cleared the status if the document
  // changed underneath, so this cannot re-upload the same document twice.
  useEffect(() => {
    if (!open || !auto || !effectiveDoc || shortenStatus !== "idle") return;
    void shorten(encodeDoc(effectiveDoc), "doc");
  }, [open, auto, effectiveDoc, shortenStatus, shorten]);

  const url = shortener.shortUrl ?? longUrl;

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 200, margin: 1 }).then(setQr).catch(() => setQr(""));
  }, [url]);

  if (!doc || !effectiveDoc) return null;

  const amount = payableAmount(effectiveDoc);
  const currency = doc.b.cur;
  const phone = recipientPhone(effectiveDoc);
  const longLink = url.length > 1800;

  // The sender is writing this, so it is composed in the sender's language.
  const message = [
    fill(t("sdDocFrom"), { title: docTitle(effectiveDoc, lang), business: doc.b.n }),
    amount > 0 ? fill(t("sdAmountLine"), { amount: formatMoney(amount, currency) }) : "",
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
    await shareViaWeb({ title: docTitle(effectiveDoc, lang), text: message });
  };

  // UPI is an India/INR rail; only offer the payment setup for INR documents.
  const upiEnabled = supportsUpi(currency);

  return (
    <Modal open={open} onClose={onClose} title={title ?? t("sdShare")}>
      <div className="space-y-4">
        {/* Payment setup — INR only */}
        {upiEnabled ? (
        <div className="rounded-lg border border-muted-line/30 p-3">
          <label className="block text-sm font-semibold text-ink">
            {t(amount > 0 ? "sdUpiId" : "sdUpiIdOptional")}
          </label>
          <input
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder={t("sdUpiPlaceholder")}
            className="mt-1 w-full rounded-lg border border-muted-line/40 px-3 py-2 text-sm outline-none focus:border-indigo"
          />
          {upiId.trim() && !isValidUPIId(upiId.trim()) ? (
            <p className="mt-1 text-xs text-amber-600">{t("sdInvalidUpi")}</p>
          ) : null}
          {onSaveUpiDefault && upiId.trim() && upiId.trim() !== (doc.b.u ?? "") ? (
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={saveDefault}
                onChange={(e) => setSaveDefault(e.target.checked)}
                className="h-4 w-4 accent-indigo"
              />
              {t("sdSaveDefaultUpi")}
            </label>
          ) : null}

          {allowFee ? (
            <div className="mt-3">
              <label className="block text-sm font-semibold text-ink">
                {t("sdAdvanceFee")}
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
            <img src={qr} alt={t("sdLinkQrAlt")} className="h-24 w-24 shrink-0 rounded-lg border border-muted-line/30 bg-white p-1" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("sdShareableLink")}
            </p>
            <p className="mt-1 break-all rounded-lg bg-cream-paper/60 p-2 text-xs text-ink">{url}</p>

            {shortener.offered && !shortener.shortUrl ? (
              <div className="mt-2">
                {shortener.auto ? (
                  shortener.status === "working" ? (
                    <p className="text-xs text-muted">{t("sdShortening")}</p>
                  ) : null
                ) : (
                  <button
                    type="button"
                    onClick={() => shortener.shorten(encodeDoc(effectiveDoc), "doc")}
                    disabled={shortener.status === "working"}
                    className="rounded-lg border border-indigo/30 px-3 py-1.5 text-xs font-semibold text-indigo disabled:opacity-60"
                  >
                    {t(shortener.status === "working" ? "sdShortening" : "sdShortenLink")}
                  </button>
                )}

                {shortener.status === "error" && shortener.failure === "offline" ? (
                  <p className="mt-1 text-xs text-amber-600">{t("sdShortenOffline")}</p>
                ) : null}

                {shortener.status === "error" && shortener.failure !== "offline" ? (
                  <p className="mt-1 text-xs text-amber-600">{t("sdShortenFailed")}</p>
                ) : null}
              </div>
            ) : null}

            {shortener.shortUrl ? (
              <p className="mt-1 text-xs text-muted">{t("sdShortened")}</p>
            ) : longLink ? (
              <p className="mt-1 text-xs text-muted">{t("sdLongLink")}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onWhatsApp} className={`${primaryBtnClass} flex-1`}>
            {phone
              ? fill(t("sdWhatsAppTo"), {
                  recipient: recipientLabel ?? t("sdRecipientCustomer"),
                })
              : t("sdWhatsApp")}
          </button>
          <button type="button" onClick={copy} className={`${secondaryBtnClass} flex-1`}>
            {copied ? `${t("copied")} ✓` : t("qmCopyLink")}
          </button>
          {canShare() ? (
            <button type="button" onClick={onNativeShare} className={`${secondaryBtnClass} flex-1`}>
              {t("sdShareEllipsis")}
            </button>
          ) : null}
        </div>

        <p className="text-xs text-muted">
          {t(shortener.shortUrl ? "sdFootStored" : "sdFootInline")}
        </p>
      </div>
    </Modal>
  );
}
