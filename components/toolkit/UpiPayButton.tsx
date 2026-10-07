"use client";

// UPI "Pay now" control: a deep-link button (opens GPay/PhonePe/Paytm on
// mobile) plus a scannable QR of the same upi://pay link for desktop payers.
// Used on shared invoice / quotation / reminder / appointment viewer pages.

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { generateUPIUrl, isValidUPIId } from "@/lib/upi";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { formatMoney } from "@/lib/pos/types";

export function UpiPayButton({
  upiId,
  amount,
  businessName,
  note,
  currency,
}: {
  upiId: string;
  amount: number;
  businessName: string;
  note: string;
  currency: string;
}) {
  const { t } = useI18n();
  const [qr, setQr] = useState<string>("");

  const valid = isValidUPIId(upiId) && amount > 0;
  const upiUrl = valid ? generateUPIUrl(upiId, amount, note, businessName) : "";

  useEffect(() => {
    if (!upiUrl) {
      setQr("");
      return;
    }
    QRCode.toDataURL(upiUrl, { width: 220, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [upiUrl]);

  if (!valid) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
      <p className="text-sm font-semibold text-emerald-800">
        {fill(t("upPayVia"), { amount: formatMoney(amount, currency) })}
      </p>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qr}
          alt={t("upQrAlt")}
          className="mx-auto mt-3 h-44 w-44 rounded-lg bg-white p-2"
        />
      ) : null}
      <p className="mt-2 text-xs text-emerald-700">
        {fill(t("upScanToPay"), { business: businessName })}
      </p>
      <a
        href={upiUrl}
        className="mt-3 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        {t("upPayNow")}
      </a>
      <p className="mt-2 break-all text-[11px] text-emerald-700/70">{upiId}</p>
    </div>
  );
}
