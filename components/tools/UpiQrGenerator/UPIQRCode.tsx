"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { generateUPIUrl } from "@/lib/upi";

interface UPIQRCodeProps {
  upiId: string;
  amount?: number;
  notes?: string;
}

export function UPIQRCode({ upiId, amount, notes }: UPIQRCodeProps) {
  const [qrSvg, setQrSvg] = useState<string>("");

  const upiUrl = generateUPIUrl(upiId, amount, notes);

  useEffect(() => {
    if (upiId && upiUrl) {
      QRCode.toString(upiUrl, {
        type: "svg",
        width: 200,
        margin: 1,
        errorCorrectionLevel: "H",
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
        .then((svg: string) => {
          setQrSvg(svg);
        })
        .catch((err: Error) => {
          console.error("Failed to generate QR code:", err);
        });
    }
  }, [upiUrl, upiId]);

  if (!upiId || !qrSvg) return null;

  return (
    <div
      dangerouslySetInnerHTML={{ __html: qrSvg }}
      style={{
        display: "inline-block",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "8px",
        backgroundColor: "white",
      }}
    />
  );
}
