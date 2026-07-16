"use client";

import { useRef, useState } from "react";
import { Download, Copy, Check, Upload, X } from "lucide-react";
import { isValidUPIId, generateUPIUrl } from "@/lib/upi";
import { UPIQRCode } from "../UpiQrGenerator/UPIQRCode";
import { ShareButton } from "@/components/tools/ShareButton";

const SETU_LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><rect width="120" height="120" rx="20" fill="#ECEAE3"/><path d="M18 98 L18 56 C18 40 28 31 46 31 L74 31 C92 31 102 40 102 56 L102 98" fill="none" stroke="#26306B" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const SETU_LOGO_DATA_URL = `data:image/svg+xml,${encodeURIComponent(SETU_LOGO_SVG)}`;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });

export function UpiQrGeneratorTool() {
  const [upiId, setUpiId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [upiIdError, setUpiIdError] = useState("");
  const [copied, setCopied] = useState(false);
  const [logo, setLogo] = useState<string | null>(SETU_LOGO_DATA_URL);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file (PNG, JPG, or SVG).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Logo image must be smaller than 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setLogo(reader.result);
      }
    };
    reader.readAsDataURL(file);

    // Allow re-selecting the same file later
    e.target.value = "";
  };

  // Draws the QR code (and centered logo, if set) onto a 300x300 canvas.
  // Shared by the download and share paths so both include the logo.
  const renderQrCanvas = async (): Promise<HTMLCanvasElement | null> => {
    const qrElement = document.querySelector('[data-qr="upi"]') as HTMLElement | null;
    const svg = qrElement?.querySelector("svg");
    if (!svg) return null;

    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    try {
      const svgData = new XMLSerializer().serializeToString(svg);
      const qrImg = await loadImage("data:image/svg+xml;base64," + btoa(svgData));

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(qrImg, 0, 0, canvas.width, canvas.height);

      if (logo) {
        const logoImg = await loadImage(logo);

        // White rounded backdrop so the logo stays readable over QR modules
        const box = 76;
        const radius = 10;
        const x = (canvas.width - box) / 2;
        const y = (canvas.height - box) / 2;
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + box, y, x + box, y + box, radius);
        ctx.arcTo(x + box, y + box, x, y + box, radius);
        ctx.arcTo(x, y + box, x, y, radius);
        ctx.arcTo(x, y, x + box, y, radius);
        ctx.closePath();
        ctx.fill();

        // Fit the logo inside the backdrop, keeping its aspect ratio
        const inner = 62;
        const naturalW = logoImg.width || inner;
        const naturalH = logoImg.height || inner;
        const ratio = Math.min(inner / naturalW, inner / naturalH);
        const w = naturalW * ratio;
        const h = naturalH * ratio;
        ctx.drawImage(logoImg, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      }

      return canvas;
    } catch (err) {
      console.error("Failed to render QR canvas:", err);
      return null;
    }
  };

  const handleDownloadQR = async () => {
    const canvas = await renderQrCanvas();
    if (!canvas) return;

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `upi-qr-${Date.now()}.png`;
    link.click();
  };

  const generateShareFiles = async () => {
    const canvas = await renderQrCanvas();
    if (!canvas) return [];

    return new Promise<File[]>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve([
            new File([blob], `upi-qr-${Date.now()}.png`, { type: "image/png" }),
          ]);
        } else {
          resolve([]);
        }
      }, "image/png");
    });
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

            {/* Logo Picker */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-ink">
                Logo on QR (Optional)
              </label>
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-muted-line/40 bg-white p-1.5">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logo}
                      alt="QR logo"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-muted">No logo</span>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-2 text-xs font-semibold text-indigo transition hover:bg-indigo/10"
                >
                  <Upload className="h-4 w-4" />
                  {logo ? "Replace Logo" : "Upload Logo"}
                </button>

                {logo ? (
                  <button
                    onClick={() => setLogo(null)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={() => setLogo(SETU_LOGO_DATA_URL)}
                    className="inline-flex items-center gap-2 rounded-lg border border-muted-line/40 bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:bg-cream"
                  >
                    Use Setu Logo
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-muted">
                Shown at the center of your QR code. Upload your business logo or remove it.
              </p>
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
                    <UPIQRCode
                      upiId={upiId}
                      amount={amount ? parseFloat(amount) : undefined}
                      notes={notes}
                      logo={logo}
                    />
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
                  text={`Scan this QR code to pay ${upiId} via UPI`}
                  generateFiles={generateShareFiles}
                />
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
