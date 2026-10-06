"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import {
  Card,
  Field,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextInput,
} from "@/components/toolkit/ui";
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useWorkspaceConnection } from "@/lib/hooks/useWorkspaceConnection";
import { useI18n, type DictKey } from "@/lib/i18n";
import { useReviewPrompt } from "@/lib/hooks/useReviewPrompt";
import { ReviewPromptDialog } from "@/components/review/ReviewPrompt";

type BarcodeKind = "CODE128" | "EAN13" | "QR";

/** What each format accepts, as a dictionary key per kind. */
const KIND_HINTS: Record<BarcodeKind, DictKey> = {
  CODE128: "bgTypeCode128",
  EAN13: "bgTypeEan13",
  QR: "bgTypeQr",
};

export function BarcodeGeneratorTool() {
  const workspace = useWorkspaceConnection("barcode-generator");
  const { t } = useI18n();
  const [kind, setKind] = useState<BarcodeKind>("CODE128");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!value.trim()) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setError(null);
      return;
    }
    try {
      if (kind === "QR") {
        await QRCode.toCanvas(canvas, value.trim(), { width: 280, margin: 2 });
      } else {
        JsBarcode(canvas, value.trim(), {
          format: kind,
          displayValue: true,
          fontSize: 16,
          margin: 12,
          height: 90,
        });
      }
      setError(null);
    } catch {
      setError(
        kind === "EAN13"
          ? t("bgEan13Digits")
          : t("bgCannotEncode")
      );
    }
  }, [kind, value]);

  useEffect(() => {
    render();
  }, [render]);

  const fileBase = () =>
    (label || value || "barcode").replace(/[^\w-]+/g, "-").slice(0, 40) || "barcode";

  const review = useReviewPrompt();

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas || !value.trim() || error) return;
    const link = document.createElement("a");
    link.download = `${fileBase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    // The label is on their disk: the cycle is finished.
    review.complete();
  };

  const downloadPdf = () => {
    const canvas = canvasRef.current;
    if (!canvas || !value.trim() || error) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a6" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const imgW = Math.min(90, pageW - 20);
    const imgH = (canvas.height / canvas.width) * imgW;
    const y = (pageH - imgH) / 2;
    if (label) {
      doc.setFontSize(12);
      doc.text(label, pageW / 2, y - 4, { align: "center" });
    }
    doc.addImage(canvas.toDataURL("image/png"), "PNG", (pageW - imgW) / 2, y, imgW, imgH);
    doc.save(`${fileBase()}.pdf`);
    review.complete();
  };

  const pickProduct = (id: string) => {
    const product = workspace.products.find((p) => p.id === id);
    if (!product) return;
    setValue(product.barcode || product.sku || product.name);
    setLabel(product.name);
    if (product.barcode && /^\d{12,13}$/.test(product.barcode)) setKind("EAN13");
    else if (kind === "EAN13") setKind("CODE128");
  };

  return (
    <div>
      <WorkspaceBanner
        connection={workspace}
        message={t("bgConnectHint")}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-bold text-ink">{t("bgDetails")}</h2>
          <div className="space-y-4">
            {workspace.connected && workspace.products.length > 0 ? (
              <Field label={t("bgPickProduct")}>
                <Select defaultValue="" onChange={(e) => pickProduct(e.target.value)}>
                  <option value="" disabled>
                    {t("bgChooseProduct")}
                  </option>
                  {workspace.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <Field label={t("bgType")}>
              <Select value={kind} onChange={(e) => setKind(e.target.value as BarcodeKind)}>
                <option value="CODE128">Code 128</option>
                <option value="EAN13">EAN-13</option>
                <option value="QR">QR Code</option>
              </Select>
            </Field>
            <p className="-mt-2 text-xs text-muted">{t(KIND_HINTS[kind])}</p>

            <Field label={t("bgValue")}>
              <TextInput
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={kind === "EAN13" ? "890123456789" : "SKU-001 or any text"}
              />
            </Field>

            <Field label={t("bgLabel")}>
              <TextInput
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t("productNamePlaceholder")}
              />
            </Field>
          </div>
        </Card>

        <Card className="flex flex-col">
          <h2 className="mb-4 text-lg font-bold text-ink">{t("preview")}</h2>
          <div className="flex flex-1 items-center justify-center rounded-xl bg-cream-paper/60 p-6">
            {value.trim() ? (
              <canvas ref={canvasRef} className="max-w-full" />
            ) : (
              <p className="text-sm text-muted">{t("bgEnterValue")}</p>
            )}
          </div>
          {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
          <div className="mt-4 flex gap-3">
            <PrimaryButton onClick={downloadPng} disabled={!value.trim() || !!error}>
              {t("download")} PNG
            </PrimaryButton>
            <SecondaryButton onClick={downloadPdf} disabled={!value.trim() || !!error}>
              {t("download")} PDF
            </SecondaryButton>
          </div>
        </Card>
      </div>

      <ReviewPromptDialog
        open={review.open}
        onAccept={review.accept}
        onDecline={review.decline}
      />
    </div>
  );
}
