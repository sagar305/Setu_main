"use client";

import { useMemo, useState } from "react";
import JsBarcode from "jsbarcode";
import {
  Card,
  EmptyState,
  Field,
  NumberInput,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextInput,
} from "@/components/toolkit/ui";
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useWorkspaceConnection } from "@/lib/hooks/useWorkspaceConnection";
import { currencySymbol, generateId } from "@/lib/pos/types";
import { useI18n } from "@/lib/i18n";

type LabelRow = {
  id: string;
  name: string;
  price: string;
  code: string;
  qty: number;
};

type LabelFormat = {
  id: string;
  name: string;
  kind: "a4" | "thermal";
  widthMm: number;
  heightMm: number;
  perRow: number;
};

const FORMATS: LabelFormat[] = [
  { id: "a4-65", name: "A4 sheet — 65 labels (38.1 × 21.2 mm)", kind: "a4", widthMm: 38.1, heightMm: 21.2, perRow: 5 },
  { id: "a4-40", name: "A4 sheet — 40 labels (48.5 × 25.4 mm)", kind: "a4", widthMm: 48.5, heightMm: 25.4, perRow: 4 },
  { id: "a4-24", name: "A4 sheet — 24 labels (64 × 34 mm)", kind: "a4", widthMm: 64, heightMm: 34, perRow: 3 },
  { id: "roll-50x25", name: "Thermal roll — 50 × 25 mm", kind: "thermal", widthMm: 50, heightMm: 25, perRow: 1 },
  { id: "roll-38x25", name: "Thermal roll — 38 × 25 mm", kind: "thermal", widthMm: 38, heightMm: 25, perRow: 1 },
];

function barcodeDataUrl(value: string): string | null {
  if (!value.trim()) return null;
  try {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, value.trim(), {
      format: "CODE128",
      displayValue: false,
      margin: 0,
      height: 40,
      width: 1.5,
    });
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export function LabelPrinterTool() {
  const workspace = useWorkspaceConnection("label-printer");
  const { t } = useI18n();
  const [formatId, setFormatId] = useState("a4-65");
  const [rows, setRows] = useState<LabelRow[]>([]);
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showCode, setShowCode] = useState(false);

  const format = FORMATS.find((f) => f.id === formatId)!;
  const currency = currencySymbol(workspace.business?.currency ?? "INR");

  const addManualRow = () =>
    setRows((prev) => [...prev, { id: generateId(), name: "", price: "", code: "", qty: 1 }]);

  const addProductRow = (productId: string) => {
    const p = workspace.products.find((x) => x.id === productId);
    if (!p) return;
    setRows((prev) => [
      ...prev,
      {
        id: generateId(),
        name: p.name,
        price: String(p.sellingPrice || ""),
        code: p.barcode || p.sku,
        qty: 1,
      },
    ]);
  };

  const updateRow = (id: string, patch: Partial<LabelRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const totalLabels = useMemo(() => rows.reduce((n, r) => n + Math.max(0, r.qty), 0), [rows]);

  const print = () => {
    const labels = rows.flatMap((row) =>
      Array.from({ length: Math.max(0, row.qty) }, () => row)
    );
    if (labels.length === 0) return;

    const cells = labels
      .map((row) => {
        const barcode = showBarcode ? barcodeDataUrl(row.code) : null;
        return `<div class="label">
          ${showName && row.name ? `<div class="name">${escapeHtml(row.name)}</div>` : ""}
          ${showPrice && row.price ? `<div class="price">${currency}${escapeHtml(row.price)}</div>` : ""}
          ${barcode ? `<img class="bar" src="${barcode}" alt="" />` : ""}
          ${showCode && row.code ? `<div class="code">${escapeHtml(row.code)}</div>` : ""}
        </div>`;
      })
      .join("");

    const pageCss =
      format.kind === "a4"
        ? `@page { size: A4; margin: 10mm; }
           .sheet { display: flex; flex-wrap: wrap; gap: 2mm; }`
        : `@page { size: ${format.widthMm}mm ${format.heightMm}mm; margin: 0; }
           .sheet { display: block; }
           .label { page-break-after: always; }`;

    const html = `<!doctype html><html><head><title>Labels</title><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; }
      ${pageCss}
      .label {
        width: ${format.widthMm}mm; height: ${format.heightMm}mm;
        overflow: hidden; display: flex; flex-direction: column;
        align-items: center; justify-content: center; text-align: center;
        padding: 1mm; border: ${format.kind === "a4" ? "0.2mm dotted #ccc" : "none"};
      }
      .name { font-size: 8pt; font-weight: bold; line-height: 1.1; max-height: 2.3em; overflow: hidden; }
      .price { font-size: 10pt; font-weight: bold; margin-top: 0.5mm; }
      .bar { width: 90%; max-height: ${Math.max(6, format.heightMm * 0.35)}mm; margin-top: 0.5mm; }
      .code { font-size: 6.5pt; margin-top: 0.3mm; }
      @media print { .label { border: none; } }
    </style></head><body><div class="sheet">${cells}</div>
    <script>window.onload = () => { window.print(); };</script></body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div>
      <WorkspaceBanner
        connection={workspace}
        message="Print price labels for your saved products without retyping them."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">Labels to print</h2>
            <div className="flex gap-2">
              <SecondaryButton onClick={addManualRow}>+ Add label</SecondaryButton>
            </div>
          </div>

          {workspace.connected && workspace.products.length > 0 ? (
            <div className="mb-4">
              <Field label="Add from saved products">
                <Select value="" onChange={(e) => e.target.value && addProductRow(e.target.value)}>
                  <option value="">Choose a product…</option>
                  {workspace.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : null}

          {rows.length === 0 ? (
            <EmptyState
              title="No labels yet"
              subtitle="Add labels manually, or connect your workspace to pull in saved products with names, prices and barcodes."
              action={<PrimaryButton onClick={addManualRow}>Add your first label</PrimaryButton>}
            />
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-2 items-end gap-2 rounded-lg border border-muted-line/30 p-3 sm:grid-cols-[1fr_90px_1fr_70px_auto]"
                >
                  <Field label={t("name")}>
                    <TextInput
                      value={row.name}
                      onChange={(e) => updateRow(row.id, { name: e.target.value })}
                      placeholder="Product name"
                    />
                  </Field>
                  <Field label={t("price")}>
                    <TextInput
                      value={row.price}
                      onChange={(e) => updateRow(row.id, { price: e.target.value })}
                      placeholder="99"
                    />
                  </Field>
                  <Field label="Barcode / SKU">
                    <TextInput
                      value={row.code}
                      onChange={(e) => updateRow(row.id, { code: e.target.value })}
                      placeholder="SKU-001"
                    />
                  </Field>
                  <Field label={t("quantity")}>
                    <NumberInput
                      min={1}
                      value={row.qty}
                      onChange={(e) => updateRow(row.id, { qty: Number(e.target.value) || 1 })}
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="mb-1 justify-self-end text-sm font-semibold text-red-500 hover:text-red-600"
                    aria-label="Remove label"
                  >
                    {t("remove")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-bold text-ink">Label format</h2>
            <Field label="Sheet / roll size">
              <Select value={formatId} onChange={(e) => setFormatId(e.target.value)}>
                {FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </Field>

            <h3 className="mb-2 mt-5 text-sm font-bold text-ink">Show on label</h3>
            <div className="space-y-2 text-sm text-ink">
              {(
                [
                  ["Product name", showName, setShowName],
                  ["Price", showPrice, setShowPrice],
                  ["Barcode", showBarcode, setShowBarcode],
                  ["Code text (SKU)", showCode, setShowCode],
                ] as const
              ).map(([labelText, checked, setter]) => (
                <label key={labelText} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setter(e.target.checked)}
                    className="h-4 w-4 accent-indigo"
                  />
                  {labelText}
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink">{totalLabels}</span> label
              {totalLabels === 1 ? "" : "s"} ready
            </p>
            <PrimaryButton className="mt-3 w-full" onClick={print} disabled={totalLabels === 0}>
              {t("print")}
            </PrimaryButton>
            <p className="mt-2 text-xs text-muted">
              Opens your browser&apos;s print dialog — choose the printer and paper there.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
