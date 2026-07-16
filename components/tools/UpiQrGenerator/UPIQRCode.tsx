"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { generateUPIUrl } from "@/lib/upi";

interface UPIQRCodeProps {
  upiId: string;
  amount?: number;
  notes?: string;
  logo?: string | null;
}

export function UPIQRCode({ upiId, amount, notes, logo }: UPIQRCodeProps) {
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
      style={{
        position: "relative",
        display: "inline-block",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "8px",
        backgroundColor: "white",
      }}
    >
      <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
      {logo && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              padding: "5px",
              borderRadius: "8px",
              backgroundColor: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt=""
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
