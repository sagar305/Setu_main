"use client";

import { useRef, useState } from "react";
import { Download, Printer, RotateCcw, Building2, Users, FileText, ShoppingCart, BookOpen, Banknote, Palette, Eye, EyeOff, ChevronRight } from "lucide-react";
import { InvoicePreview } from "./InvoicePreview";
import { BusinessDetailsSection } from "./BusinessDetailsSection";
import { ClientDetailsSection } from "./ClientDetailsSection";
import { InvoiceDetailsSection } from "./InvoiceDetailsSection";
import { LineItemsSection } from "./LineItemsSection";
import { BankDetailsSection } from "./BankDetailsSection";
import { NotesAndTermsSection } from "./NotesAndTermsSection";
import { TemplateSelector } from "./TemplateSelector";
import { AccordionSection } from "./AccordionSection";
import { useInvoiceData } from "@/lib/hooks/useInvoiceData";
import { exportInvoiceToPdf } from "@/lib/pdf/exportInvoiceToPdf";

export function InvoiceGeneratorTool() {
  const {
    data,
    isLoaded,
    lockedSections,
    openSections,
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
    toggleLockSection,
    toggleSection,
  } = useInvoiceData();

  const previewRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const incrementInvoiceNumber = (currentNumber: string): string => {
    // Match pattern: anything-digits (e.g., "qwe-123", "INV-001", "qwe-123-abc")
    const match = currentNumber.match(/^(.+?)-(\d+)(.*)$/);

    if (!match) {
      // No pattern match - return as is
      return currentNumber;
    }

    const prefix = match[1]; // e.g., "qwe"
    const numPart = match[2]; // e.g., "123"
    const suffix = match[3]; // e.g., "" or "-abc"

    const currentNum = parseInt(numPart, 10);
    const nextNum = currentNum + 1;

    // Preserve padding (e.g., "001" → "002", "123" → "124")
    const paddedNum = numPart.length === 1
      ? nextNum.toString()
      : nextNum.toString().padStart(numPart.length, "0");

    return `${prefix}-${paddedNum}${suffix}`;
  };

  const clearUnlockedFields = () => {
    // Clear only unlocked sections
    if (!lockedSections.invoice) {
      updateInvoiceDetails({
        number: "",
        date: new Date().toISOString().split("T")[0],
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        poNumber: "",
        ewayBillNumber: "",
      });
    } else {
      // Invoice section is locked - auto-increment invoice number
      const currentNumber = data.invoiceDetails.number;
      const incrementedNumber = incrementInvoiceNumber(currentNumber);
      if (incrementedNumber !== currentNumber) {
        updateInvoiceDetails({ number: incrementedNumber });
      }
    }

    if (!lockedSections.items) {
      // Clear line items - start with one empty item
      // This is handled by resetting and adding one item
      while (data.lineItems.length > 1) {
        removeLineItem(data.lineItems[0].id);
      }
      if (data.lineItems.length > 0) {
        updateLineItem(data.lineItems[0].id, {
          description: "",
          quantity: 1,
          unit: "Qty",
          rate: 0,
          discountPercent: 0,
          taxRate: 18,
        });
      }
    }

    if (!lockedSections.notes) {
      updateNotes("");
      updateTerms("");
    }

    if (!lockedSections.client) {
      updateClientDetails({
        name: "",
        address: "",
        phone: "",
        email: "",
        gstin: "",
      });
    }
  };

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
    <div className="space-y-0">
      <div className="space-y-6 px-6 py-6">
        {/* Error Message */}
        {error && (
          <div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Sticky Action Buttons */}
        <div className="sticky top-20 z-30 flex flex-wrap gap-3 rounded-lg bg-white/95 backdrop-blur-sm p-4 shadow-sm">
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo bg-indigo px-4 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {isExporting ? "Generating PDF..." : "Download PDF"}
          </button>

          <button
            onClick={() => {
              handlePrint();
              clearUnlockedFields();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 font-semibold text-orange-600 transition hover:border-orange-400 hover:bg-orange-100"
            title="Print invoice and clear unlocked fields for next invoice"
          >
            <Printer className="h-4 w-4" />
            Print & Clear
          </button>

          <button
            onClick={clearUnlockedFields}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo bg-indigo px-4 py-2 font-semibold text-white transition hover:bg-indigo-700"
            title="Clear unlocked fields and prepare for next invoice"
          >
            <ChevronRight className="h-4 w-4" />
            Next Invoice
          </button>

          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-muted-line/40 bg-white px-4 py-2 font-semibold text-ink transition hover:bg-cream"
          >
            <RotateCcw className="h-4 w-4" />
            Reset All
          </button>
        </div>

        {/* Preview Toggle Button */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="inline-flex items-center gap-2 rounded-lg border border-muted-line/30 px-3 py-2 text-sm font-semibold text-muted transition hover:border-indigo hover:text-indigo"
          >
            {showPreview ? (
              <>
                <EyeOff className="h-4 w-4" />
                <span className="hidden sm:inline">Hide Preview</span>
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">Show Preview</span>
              </>
            )}
          </button>
        </div>

        {/* Main Layout: Desktop 2-column (when preview visible), full width when hidden */}
        <div className={`grid gap-8 ${showPreview ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
          {/* Left: Accordion Form */}
          <div>
            <div className="rounded-2xl border border-indigo/15 bg-white shadow-sm overflow-hidden">
              {/* Business Details */}
              <AccordionSection
                title="Business Details"
                icon={<Building2 className="h-5 w-5" />}
                isOpen={openSections.business}
                onToggle={() => toggleSection("business")}
                isLocked={lockedSections.business}
                onToggleLock={() => toggleLockSection("business")}
              >
                <BusinessDetailsSection
                  data={data.businessDetails}
                  onChange={updateBusinessDetails}
                />
              </AccordionSection>

              {/* Client Details */}
              <AccordionSection
                title="Bill To"
                icon={<Users className="h-5 w-5" />}
                isOpen={openSections.client}
                onToggle={() => toggleSection("client")}
                isLocked={lockedSections.client}
                onToggleLock={() => toggleLockSection("client")}
              >
                <ClientDetailsSection
                  data={data.clientDetails}
                  onChange={updateClientDetails}
                />
              </AccordionSection>

              {/* Invoice Details */}
              <AccordionSection
                title="Invoice Details"
                icon={<FileText className="h-5 w-5" />}
                isOpen={openSections.invoice}
                onToggle={() => toggleSection("invoice")}
                isLocked={lockedSections.invoice}
                onToggleLock={() => toggleLockSection("invoice")}
              >
                <InvoiceDetailsSection
                  data={data.invoiceDetails}
                  onChange={updateInvoiceDetails}
                />
              </AccordionSection>

              {/* Line Items */}
              <AccordionSection
                title="Line Items"
                icon={<ShoppingCart className="h-5 w-5" />}
                isOpen={openSections.items}
                onToggle={() => toggleSection("items")}
                isLocked={lockedSections.items}
                onToggleLock={() => toggleLockSection("items")}
              >
                <LineItemsSection
                  items={data.lineItems}
                  taxMode={data.taxMode}
                  onAddItem={addLineItem}
                  onRemoveItem={removeLineItem}
                  onUpdateItem={updateLineItem}
                />
              </AccordionSection>

              {/* Bank Details */}
              <AccordionSection
                title="Bank & Payment"
                icon={<Banknote className="h-5 w-5" />}
                isOpen={openSections.bank}
                onToggle={() => toggleSection("bank")}
                isLocked={lockedSections.bank}
                onToggleLock={() => toggleLockSection("bank")}
              >
                <BankDetailsSection
                  data={data.bankDetails}
                  onChange={updateBankDetails}
                />
              </AccordionSection>

              {/* Notes & Terms */}
              <AccordionSection
                title="Notes & Terms"
                icon={<BookOpen className="h-5 w-5" />}
                isOpen={openSections.notes}
                onToggle={() => toggleSection("notes")}
                isLocked={lockedSections.notes}
                onToggleLock={() => toggleLockSection("notes")}
              >
                <NotesAndTermsSection
                  notes={data.notes}
                  terms={data.terms}
                  onNotesChange={updateNotes}
                  onTermsChange={updateTerms}
                />
              </AccordionSection>

              {/* Template */}
              <AccordionSection
                title="Template & Brand"
                icon={<Palette className="h-5 w-5" />}
                isOpen={openSections.template}
                onToggle={() => toggleSection("template")}
                isLocked={lockedSections.template}
                onToggleLock={() => toggleLockSection("template")}
              >
                <TemplateSelector
                  selectedTemplate={data.template}
                  brandColor={data.brandColor}
                  onTemplateChange={updateTemplate}
                  onBrandColorChange={updateBrandColor}
                />
              </AccordionSection>
            </div>
          </div>

          {/* Right: Preview - Conditionally shown */}
          {showPreview && (
            <div className="hidden lg:block">
              <div className="sticky top-24 overflow-auto rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm sm:p-8" style={{ maxHeight: "calc(100vh - 200px)" }}>
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
          )}
        </div>

        {/* Mobile Preview (below form on mobile) - Conditionally shown */}
        {showPreview && (
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
        )}
      </div>
    </div>
  );
}
