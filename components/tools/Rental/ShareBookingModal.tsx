"use client";

// The one place a booking leaves this device.
//
// Everything a customer receives — a quote, a confirmation, a return reminder,
// a settled note — is the same two things: a message built from the owner's own
// template, and a link to the document itself. So it is one sheet rather than
// six, with the template picker at the top.
//
// The link starts self-contained: the whole hire rides in the URL fragment and
// nothing is uploaded. With "shorten every link automatically" turned on in the
// Business Profile, the sheet shortens it as it opens — the setting is the
// deliberate act, made once instead of per share — and falls back to the long
// link, silently and correctly, whenever the shortener cannot be reached.

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, MessageCircle, Send, Share2 } from "lucide-react";
import { Modal, primaryBtnClass, secondaryBtnClass } from "@/components/tools/FreePos/ui";
import { buildShareUrl, encodeDoc } from "@/lib/toolkit/shareLink";
import { useShortenLink } from "@/lib/toolkit/useShortenLink";
import { canShare, shareViaWeb } from "@/lib/share";
import { settleBooking } from "@/lib/rental/calc";
import { fillTemplate, messageDate, plainAmount, smsLink, whatsAppLink, TEMPLATE_LABELS } from "@/lib/rental/messages";
import { rentalDoc, stageFor, type RentalShareStage } from "@/lib/rental/share";
import { useRental } from "@/lib/rental/store";
import type { Booking, RentalTemplateKey } from "@/lib/rental/types";

const STAGE_FOR_TEMPLATE: Record<RentalTemplateKey, RentalShareStage> = {
  quotation: "quote",
  confirmed: "confirmed",
  dispatchReminder: "confirmed",
  returnDue: "confirmed",
  overdue: "confirmed",
  settlement: "settled",
};

/** Which message the owner most likely wants, given where the booking is. */
function defaultTemplate(booking: Booking, today: string): RentalTemplateKey {
  if (booking.status === "enquiry") return "quotation";
  if (booking.status === "returned" || booking.status === "closed") return "settlement";
  if (booking.status === "dispatched") {
    return booking.toDate < today ? "overdue" : "returnDue";
  }
  return "confirmed";
}

export function ShareBookingModal({
  open,
  onClose,
  booking,
}: {
  open: boolean;
  onClose: () => void;
  booking: Booking | null;
}) {
  const { business, settings, customerById, items, today } = useRental();
  const [templateKey, setTemplateKey] = useState<RentalTemplateKey>("confirmed");
  const [message, setMessage] = useState("");
  const [edited, setEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState("");

  const shortener = useShortenLink();
  const { reset, shorten, auto, status: shortenStatus } = shortener;

  const customer = booking ? customerById(booking.customerId) : undefined;
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  useEffect(() => {
    if (open && booking) {
      setTemplateKey(defaultTemplate(booking, today));
      setEdited(false);
      setCopied(false);
    }
  }, [open, booking, today]);

  const doc = useMemo(() => {
    if (!booking) return null;
    return rentalDoc(
      business,
      booking,
      customer,
      settings,
      itemById,
      STAGE_FOR_TEMPLATE[templateKey] ?? stageFor(booking)
    );
  }, [booking, business, customer, itemById, settings, templateKey]);

  const longUrl = useMemo(() => {
    if (!doc || typeof window === "undefined") return "";
    return buildShareUrl(doc, window.location.origin);
  }, [doc]);

  // A short code stands for one exact document. The moment the document changes
  // — a different template, a different stage — it stands for the wrong one.
  useEffect(() => {
    reset();
  }, [longUrl, reset]);

  useEffect(() => {
    if (!open || !auto || !doc || shortenStatus !== "idle") return;
    void shorten(encodeDoc(doc), "doc");
  }, [open, auto, doc, shortenStatus, shorten]);

  const url = shortener.shortUrl ?? longUrl;

  useEffect(() => {
    if (!url) {
      setQr("");
      return;
    }
    QRCode.toDataURL(url, { width: 200, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [url]);

  const composed = useMemo(() => {
    if (!booking) return "";
    const settlement = settleBooking(booking, settings, itemById, today);
    return fillTemplate(settings.messageTemplates[templateKey] ?? "", {
      businessName: business?.name ?? "",
      customerName: customer?.name ?? "",
      bookingNo: booking.bookingNo,
      eventName: booking.eventName,
      venue: booking.venue,
      venueContact: booking.venueContact,
      fromDate: messageDate(booking.fromDate),
      toDate: messageDate(booking.toDate),
      amount: plainAmount(booking.total),
      advance: plainAmount(booking.advancePaid),
      balance: plainAmount(Math.max(0, booking.total - booking.paid)),
      deposit: plainAmount(booking.depositTotal),
      lateDays: settlement.lateDays,
      lateFee: plainAmount(settlement.lateFee),
      refund: plainAmount(settlement.depositRefunded),
      validDays: settings.quotationValidDays,
      link: url,
    });
  }, [booking, business, customer, itemById, settings, templateKey, today, url]);

  // The owner's edits win until they switch template; after that the fresh
  // template is what they asked for.
  useEffect(() => {
    if (!edited) setMessage(composed);
  }, [composed, edited]);

  if (!booking || !doc) return null;

  const phone = customer?.phone ?? "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the text area is still selectable.
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Send · ${booking.bookingNo}`} wide>
      <div className="space-y-4">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {(Object.keys(TEMPLATE_LABELS) as RentalTemplateKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTemplateKey(key);
                setEdited(false);
              }}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                templateKey === key
                  ? "bg-indigo text-white"
                  : "border border-muted-line/40 bg-white text-muted hover:text-indigo"
              }`}
            >
              {TEMPLATE_LABELS[key]}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Message
          </span>
          <textarea
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setEdited(true);
            }}
            rows={5}
            className="w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2 text-sm text-ink focus:border-indigo focus:outline-none focus:ring-1 focus:ring-indigo"
          />
        </label>

        <div className="flex items-start gap-3 rounded-lg border border-muted-line/30 p-3">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="Link QR"
              className="h-24 w-24 shrink-0 rounded-lg border border-muted-line/30 bg-white p-1"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Customer link
            </p>
            <p className="mt-1 break-all rounded-lg bg-cream-paper/60 p-2 text-xs text-ink">
              {url}
            </p>

            {shortener.offered && !shortener.shortUrl ? (
              <div className="mt-2">
                {shortener.auto ? (
                  shortener.status === "working" ? (
                    <p className="text-xs text-muted">Shortening…</p>
                  ) : null
                ) : (
                  <button
                    type="button"
                    onClick={() => shortener.shorten(encodeDoc(doc), "doc")}
                    disabled={shortener.status === "working"}
                    className="rounded-lg border border-indigo/30 px-3 py-1.5 text-xs font-semibold text-indigo disabled:opacity-60"
                  >
                    {shortener.status === "working" ? "Shortening…" : "Shorten link"}
                  </button>
                )}

                {shortener.status === "error" && shortener.failure === "offline" ? (
                  <p className="mt-1 text-xs text-amber-600">
                    Shortening needs an internet connection. The full link works offline — send
                    that instead.
                  </p>
                ) : null}
                {shortener.status === "error" && shortener.failure !== "offline" ? (
                  <p className="mt-1 text-xs text-amber-600">
                    Couldn&apos;t shorten — using the full link.
                  </p>
                ) : null}
              </div>
            ) : null}

            <p className="mt-1 text-xs text-muted">
              {shortener.shortUrl
                ? "A copy is stored online so the link can stay short, and deleted 180 days after it was last opened. The customer needs a connection to open it."
                : "The whole booking travels inside the link — nothing is uploaded. The customer can open it and pay by UPI without any app or login."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={whatsAppLink(phone, message)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${primaryBtnClass} flex-1`}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            WhatsApp{phone ? "" : "…"}
          </a>
          {phone ? (
            <a href={smsLink(phone, message)} className={`${secondaryBtnClass} flex-1`}>
              <Send className="h-4 w-4" aria-hidden="true" />
              SMS
            </a>
          ) : null}
          <button type="button" onClick={copy} className={`${secondaryBtnClass} flex-1`}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            {copied ? "Copied ✓" : "Copy"}
          </button>
          {canShare() ? (
            <button
              type="button"
              onClick={() => void shareViaWeb({ title: booking.bookingNo, text: message })}
              className={`${secondaryBtnClass} flex-1`}
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share…
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
