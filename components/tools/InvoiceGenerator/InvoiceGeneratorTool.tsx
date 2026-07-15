"use client";

import { useRef, useState } from "react";
import { Download, Printer, RotateCcw } from "lucide-react";
import { InvoiceForm } from "./InvoiceForm";
import { InvoicePreview } from "./InvoicePreview";
import { TemplateSelector } from "./TemplateSelector";
import { useInvoiceData } from "@/lib/hooks/useInvoiceData";
import { exportInvoiceToPdf } from "@/lib/pdf/exportInvoiceToPdf";

export function InvoiceGeneratorTool() {
  const {
    data,
    isLoaded,
    updateBusinessDetails,
    updateClientDetails,
    updateInvoiceDetails,
    updateBankDetails,
    addLineItem,
    removeLineItem,
    updateLineItem,
    updateNotes,
    updateTerms,
    updateTemplate,
    updateBrandColor,
    reset,
  } = useInvoiceData();

  const previewRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExportPDF = async () => {
    if (!previewRef.current) return;

    setIsExporting(true);
    setError(null);

    try {
      await exportInvoiceToPdf(data, previewRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    if (!previewRef.current) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(previewRef.current.innerHTML);
    printWindow.document.close();
    printWindow.focus();

    // Add Tailwind styles
    const styles = document.querySelectorAll("style");
    styles.forEach((style) => {
      printWindow.document.head.appendChild(style.cloneNode(true));
    });

    const links = document.querySelectorAll("link[rel='stylesheet']");
    links.forEach((link) => {
      printWindow.document.head.appendChild(link.cloneNode(true));
    });

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset the entire invoice? This cannot be undone.")) {
      reset();
      setError(null);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo" />
          <p className="text-muted">Loading invoice...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleExportPDF}
          disabled={isExporting}
          className="inline-flex items-center gap-2 rounded-lg border border-indigo bg-indigo px-4 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {isExporting ? "Generating PDF..." : "Download PDF"}
        </button>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-lg border border-muted-line/40 bg-white px-4 py-2 font-semibold text-ink transition hover:bg-cream"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>

        <button
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-lg border border-muted-line/40 bg-white px-4 py-2 font-semibold text-ink transition hover:bg-cream"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      </div>

      {/* Main Layout: Desktop 2-column, Mobile stacked */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left: Form */}
        <div className="overflow-y-auto">
          <div className="space-y-8 rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm sm:p-8">
            <InvoiceForm
              data={data}
              onBusinessDetailsChange={updateBusinessDetails}
              onClientDetailsChange={updateClientDetails}
              onInvoiceDetailsChange={updateInvoiceDetails}
              onBankDetailsChange={updateBankDetails}
              onAddLineItem={addLineItem}
              onRemoveLineItem={removeLineItem}
              onUpdateLineItem={updateLineItem}
              onNotesChange={updateNotes}
              onTermsChange={updateTerms}
            />

            <div className="border-t border-muted-line/10 pt-8" />

            <TemplateSelector
              selectedTemplate={data.template}
              brandColor={data.brandColor}
              onTemplateChange={updateTemplate}
              onBrandColorChange={updateBrandColor}
            />
          </div>
        </div>

        {/* Right: Preview */}
        <div className="hidden lg:block">
          <div className="sticky top-6 overflow-auto rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm sm:p-8" style={{ maxHeight: "calc(100vh - 150px)" }}>
            <div
              ref={previewRef}
              className="bg-white"
              style={{
                fontSize: "0.875rem",
                lineHeight: "1.5",
              }}
            >
              <InvoicePreview data={data} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Preview (below form on mobile) */}
      <div className="lg:hidden">
        <div className="rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm sm:p-8">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">
            Preview
          </h3>
          <div
            ref={previewRef}
            className="overflow-x-auto bg-white"
            style={{
              fontSize: "0.75rem",
              lineHeight: "1.5",
            }}
          >
            <InvoicePreview data={data} />
          </div>
        </div>
      </div>
    </div>
  );
}
