"use client";

// UPI QR for an exact amount (upi://pay?...&am=43). Used on the billing
// screen while collecting payment and, printed, on receipts.

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Data-URL PNG of a QR for `link`; "" while generating or when link is "". */
export function useQrDataUrl(link: string, width = 240): string {
  const [qr, setQr] = useState("");
  useEffect(() => {
    if (!link) {
      setQr("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(link, { width, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr("");
      });
    return () => {
      cancelled = true;
    };
  }, [link, width]);
  return qr;
}

/** On-screen QR card for the cashier to turn towards the customer. */
export function UpiQrCard({
  link,
  amountLabel,
  upiId,
  size = 176,
}: {
  link: string;
  amountLabel: string;
  upiId: string;
  size?: number;
}) {
  const qr = useQrDataUrl(link, size * 2);
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
      <p className="text-sm font-bold text-emerald-800">Scan to pay {amountLabel}</p>
      <div
        className="mx-auto mt-2 flex items-center justify-center rounded-lg bg-white p-2"
        style={{ width: size + 16, height: size + 16 }}
      >
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`UPI QR code to pay ${amountLabel}`} width={size} height={size} />
        ) : null}
      </div>
      <p className="mt-2 break-all text-xs text-emerald-700">{upiId}</p>
      <p className="mt-0.5 text-[11px] text-emerald-700/80">
        GPay · PhonePe · Paytm · any UPI app — amount is filled in
      </p>
    </div>
  );
}
