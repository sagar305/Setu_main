"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface UPIQRCodeProps {
  upiId: string;
  amount?: number;
  businessName?: string;
}

export function UPIQRCode({ upiId, amount, businessName }: UPIQRCodeProps) {
  const [qrSvg, setQrSvg] = useState<string>("");

  // UPI deeplink format: upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&tr=REFERENCE
  const encodeURIComponent_ = (str: string) => encodeURIComponent(str);

  const upiUrl = `upi://pay?pa=${encodeURIComponent_(upiId)}${
    businessName ? `&pn=${encodeURIComponent_(businessName)}` : ""
  }${amount ? `&am=${amount}` : ""}&tn=Invoice%20Payment`;

  useEffect(() => {
    if (upiId) {
      QRCode.toString(upiUrl, {
        type: "svg",
        width: 128,
        margin: 1,
        errorCorrectionLevel: "H",
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      }).then((svg: string) => {
        setQrSvg(svg);
      }).catch((err: Error) => {
        console.error("Failed to generate QR code:", err);
      });
    }
  }, [upiUrl, upiId]);

  if (!upiId || !qrSvg) return null;

  return (
    <div className="flex justify-center print:block" style={{ breakInside: "avoid" }}>
      <div
        dangerouslySetInnerHTML={{ __html: qrSvg }}
        style={{
          display: "inline-block",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "4px",
          backgroundColor: "white",
        }}
      />
    </div>
  );
}
