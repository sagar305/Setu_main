"use client";

import { useRef, useState } from "react";
import { Download, FileUp } from "lucide-react";
import { usePos } from "@/lib/pos/store";
import { downloadCsv } from "@/lib/pos/csv";
import {
  parseSalesRows,
  readSalesFile,
  salesImportTemplateCsv,
  type SalesImportResult,
} from "@/lib/pos/salesImport";
import { calculateCartTotals } from "@/lib/pos/calc";
import { formatMoney } from "@/lib/pos/types";
import { Modal, primaryBtnClass, secondaryBtnClass } from "./ui";

export function ImportSalesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { business, settings, products, customers, payments, importSales } = usePos();
  const currency = business?.currency ?? "INR";

  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<SalesImportResult | null>(null);
  const [reduceStock, setReduceStock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const reset = () => {
    setFileName("");
    setResult(null);
    setReduceStock(false);
    setMessage("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage("");
    setFileName(file.name);
    setBusy(true);
    try {
      const rows = await readSalesFile(file);
      setResult(
        parseSalesRows(rows, {
          products,
          customers,
          payments,
          taxEnabled: settings.taxEnabled,
          defaultTaxRate: settings.defaultTaxRate,
        })
      );
    } catch {
      setResult({ sales: [], errors: ["Could not read this file. Use a .csv or .xlsx file."], unmatchedProducts: [] });
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (!result || result.errors.length || result.sales.length === 0) return;
    setBusy(true);
    try {
      const count = await importSales(result.sales, { reduceStock });
      reset();
      setMessage(`Imported ${count} bill${count === 1 ? "" : "s"}. They now appear in Orders and Reports.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  const summary = result?.sales.length
    ? (() => {
        const dates = result.sales.map((s) => s.date).sort();
        const total = result.sales.reduce(
          (sum, s) => sum + calculateCartTotals(s.lines, "flat", s.discountValue, settings.taxEnabled).total,
          0
        );
        const itemCount = result.sales.reduce((sum, s) => sum + s.lines.length, 0);
        return {
          bills: result.sales.length,
          itemCount,
          total,
          from: new Date(dates[0]).toLocaleDateString(),
          to: new Date(dates[dates.length - 1]).toLocaleDateString(),
        };
      })()
    : null;

  return (
    <Modal open={open} onClose={close} title="Import past sales">
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          Upload a CSV or Excel sheet with one row per item. Rows with the same{" "}
          <strong className="text-ink">Bill No</strong> become one bill. Only{" "}
          <strong className="text-ink">Date, Product and Quantity</strong> are required. If Price is
          empty, the product&apos;s selling price is used.
        </p>

        <button
          type="button"
          onClick={() => downloadCsv("Past_Sales_Template.csv", salesImportTemplateCsv())}
          className={secondaryBtnClass}
        >
          <Download className="h-4 w-4" />
          Download template
        </button>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-muted-line/50 px-4 py-6 text-center transition hover:border-indigo/50">
          <FileUp className="h-6 w-6 text-indigo" />
          <span className="font-semibold text-ink">{fileName || "Choose a .csv or .xlsx file"}</span>
          <span className="text-xs text-muted">Read on this device. Nothing is uploaded to a server.</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            className="sr-only"
            aria-label="Sales file"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </label>

        {result && result.errors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
            <p className="font-semibold">
              Fix {result.errors.length} problem{result.errors.length === 1 ? "" : "s"} in the file
              and upload it again:
            </p>
            <ul className="mt-1 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs">
              {result.errors.slice(0, 50).map((error) => (
                <li key={error}>{error}</li>
              ))}
              {result.errors.length > 50 && <li>…and {result.errors.length - 50} more</li>}
            </ul>
          </div>
        )}

        {summary && result && result.errors.length === 0 && (
          <div className="space-y-3 rounded-lg border border-muted-line/30 bg-cream/40 px-3 py-3">
            <p className="text-ink">
              <strong>{summary.bills}</strong> bill{summary.bills === 1 ? "" : "s"} ·{" "}
              {summary.itemCount} item line{summary.itemCount === 1 ? "" : "s"} ·{" "}
              <strong>{formatMoney(summary.total, currency)}</strong>
              <br />
              <span className="text-xs text-muted">
                {summary.from === summary.to ? summary.from : `${summary.from} to ${summary.to}`}
              </span>
            </p>
            {result.unmatchedProducts.length > 0 && (
              <p className="text-xs text-amber-700">
                Not in your products (saved as one-off items, no tax):{" "}
                {result.unmatchedProducts.slice(0, 10).join(", ")}
                {result.unmatchedProducts.length > 10 ? ` +${result.unmatchedProducts.length - 10} more` : ""}
              </p>
            )}
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={reduceStock}
                onChange={(e) => setReduceStock(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-indigo"
              />
              <span>
                <span className="font-semibold text-ink">Reduce stock for these sales</span>
                <span className="block text-xs text-muted">
                  Leave off if your current stock count already reflects them.
                </span>
              </span>
            </label>
          </div>
        )}

        {message && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
            {message}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={close} className={secondaryBtnClass}>
            {message ? "Done" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={busy || !summary || !result || result.errors.length > 0}
            className={primaryBtnClass}
          >
            {busy ? "Working…" : summary ? `Import ${summary.bills} bill${summary.bills === 1 ? "" : "s"}` : "Import"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
