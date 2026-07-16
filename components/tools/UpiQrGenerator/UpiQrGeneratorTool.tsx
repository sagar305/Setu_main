"use client";

import { useState } from "react";
import { Download, Copy, Check } from "lucide-react";
import { isValidUPIId, generateUPIUrl } from "@/lib/upi";
import { UPIQRCode } from "../UpiQrGenerator/UPIQRCode";
import { ShareButton } from "@/components/tools/ShareButton";

export function UpiQrGeneratorTool() {
  const [upiId, setUpiId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [upiIdError, setUpiIdError] = useState("");
  const [copied, setCopied] = useState(false);

  const isUPIValid = upiId.trim() && isValidUPIId(upiId);
  const upiUrl = isUPIValid ? generateUPIUrl(upiId, amount ? parseFloat(amount) : 0, notes) : "";

  const handleUpiIdChange = (value: string) => {
    setUpiId(value);
    if (value.trim()) {
      if (!isValidUPIId(value)) {
        setUpiIdError("Invalid UPI ID format. Example: name@bankname");
      } else {
        setUpiIdError("");
      }
    } else {
      setUpiIdError("");
    }
  };

  const handleCopyUPI = () => {
    navigator.clipboard.writeText(upiUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    const qrElement = document.querySelector('[data-qr="upi"]') as HTMLElement;
    if (!qrElement) return;

    const svg = qrElement.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    canvas.width = 300;
    canvas.height = 300;

    img.onload = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `upi-qr-${Date.now()}.png`;
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const generateShareFiles = async () => {
    try {
      const qrElement = document.querySelector('[data-qr="upi"]') as HTMLElement;
      if (!qrElement) return [];

      const svg = qrElement.querySelector("svg");
      if (!svg) return [];

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return [];

      const img = new Image();
      canvas.width = 300;
      canvas.height = 300;

      return new Promise<File[]>((resolve) => {
        img.onload = () => {
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          canvas.toBlob((blob) => {
            if (blob) {
              const file = new File([blob], `upi-qr-${Date.now()}.png`, {
                type: "image/png",
              });
              resolve([file]);
            } else {
              resolve([]);
            }
          }, "image/png");
        };

        img.onerror = () => resolve([]);

        img.src = "data:image/svg+xml;base64," + btoa(svgData);
      });
    } catch (err) {
      console.error("Error generating QR share file:", err);
      return [];
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="space-y-8">
        {/* Input Section */}
        <div className="rounded-2xl border border-indigo/15 bg-white p-8 shadow-sm">
          <div className="space-y-6">
            {/* UPI ID Input */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-ink">
                UPI ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => handleUpiIdChange(e.target.value)}
                placeholder="example@bankname"
                className={`w-full rounded-lg border px-4 py-3 text-base outline-none transition ${
                  upiIdError
                    ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-200"
                    : "border-muted-line/40 bg-white focus:border-indigo focus:ring-indigo/10"
                }`}
              />
              {upiIdError && <p className="mt-2 text-sm text-red-600">{upiIdError}</p>}
              {isUPIValid && (
                <p className="mt-2 text-sm text-green-600">✓ Valid UPI ID</p>
              )}
            </div>

            {/* Amount Input */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-ink">
                Amount (Optional)
              </label>
              <div className="flex items-center">
                <span className="mr-2 text-lg font-semibold text-ink">₹</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    const val = e.target.value;
                    const cleaned = val.replace(/[^0-9.]/g, "");
                    const parts = cleaned.split(".");
                    let valid = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned;
                    setAmount(valid);
                  }}
                  placeholder="0.00"
                  className="flex-1 rounded-lg border border-muted-line/40 bg-white px-4 py-3 text-base outline-none transition focus:border-indigo focus:ring-indigo/10"
                />
              </div>
            </div>

            {/* Notes Input */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-ink">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment reference or description"
                maxLength={80}
                className="w-full rounded-lg border border-muted-line/40 bg-white px-4 py-3 text-base outline-none transition focus:border-indigo focus:ring-indigo/10"
              />
              <p className="mt-1 text-xs text-muted">{notes.length}/80 characters</p>
            </div>
          </div>
        </div>

        {/* QR Code Section */}
        {isUPIValid && (
          <div className="rounded-2xl border border-indigo/15 bg-white p-8 shadow-sm">
            <div className="space-y-6">
              <div>
                <h3 className="mb-4 text-lg font-semibold text-ink">Your QR Code</h3>
                <div className="flex justify-center rounded-lg bg-gray-50 p-8">
                  <div data-qr="upi">
                    <UPIQRCode upiId={upiId} amount={amount ? parseFloat(amount) : undefined} />
                  </div>
                </div>
              </div>

              {/* Info Display */}
              <div className="space-y-3 rounded-lg bg-indigo/5 p-4">
                <div>
                  <p className="text-xs font-semibold text-muted">UPI ID</p>
                  <p className="text-sm font-medium text-ink">{upiId}</p>
                </div>
                {amount && (
                  <div>
                    <p className="text-xs font-semibold text-muted">Amount</p>
                    <p className="text-sm font-medium text-ink">₹{amount}</p>
                  </div>
                )}
                {notes && (
                  <div>
                    <p className="text-xs font-semibold text-muted">Notes</p>
                    <p className="text-sm font-medium text-ink">{notes}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleDownloadQR}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-indigo bg-indigo px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  Download QR
                </button>
                <button
                  onClick={handleCopyUPI}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-muted-line/40 bg-white px-4 py-3 font-semibold text-ink transition hover:bg-cream"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy UPI URL
                    </>
                  )}
                </button>
                <ShareButton
                  title="UPI QR Code"
                  text={`Send money via UPI: ${upiUrl}`}
                  generateFiles={generateShareFiles}
                />
              </div>

              {/* UPI URL Display */}
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="mb-1 text-xs font-semibold text-muted">UPI Deep Link</p>
                <p className="break-all text-xs text-ink font-mono">{upiUrl}</p>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isUPIValid && upiId && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-sm text-red-700">Please enter a valid UPI ID to generate QR code</p>
          </div>
        )}

        {!upiId && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
            <p className="text-sm text-amber-700">Enter your UPI ID above to generate a dynamic QR code</p>
          </div>
        )}
      </div>
    </div>
  );
}
