"use client";

import { BusinessDetailsSection } from "./BusinessDetailsSection";
import { ClientDetailsSection } from "./ClientDetailsSection";
import { InvoiceDetailsSection } from "./InvoiceDetailsSection";
import { LineItemsSection } from "./LineItemsSection";
import { NotesAndTermsSection } from "./NotesAndTermsSection";
import { BankDetailsSection } from "./BankDetailsSection";
import type { InvoiceData, BusinessDetails, ClientDetails, InvoiceDetails, BankDetails, LineItem } from "@/lib/types/invoice";

interface InvoiceFormProps {
  data: InvoiceData;
  onBusinessDetailsChange: (data: Partial<BusinessDetails>) => void;
  onClientDetailsChange: (data: Partial<ClientDetails>) => void;
  onInvoiceDetailsChange: (data: Partial<InvoiceDetails>) => void;
  onBankDetailsChange: (data: Partial<BankDetails>) => void;
  onAddLineItem: () => void;
  onRemoveLineItem: (id: string) => void;
  onUpdateLineItem: (id: string, updates: Partial<LineItem>) => void;
  onTaxModeChange: (mode: "inclusive" | "exclusive") => void;
  onNotesChange: (notes: string) => void;
  onTermsChange: (terms: string) => void;
}

export function InvoiceForm({
  data,
  onBusinessDetailsChange,
  onClientDetailsChange,
  onInvoiceDetailsChange,
  onBankDetailsChange,
  onAddLineItem,
  onRemoveLineItem,
  onUpdateLineItem,
  onTaxModeChange,
  onNotesChange,
  onTermsChange,
}: InvoiceFormProps) {
  return (
    <div className="space-y-8">
      <BusinessDetailsSection
        data={data.businessDetails}
        onChange={onBusinessDetailsChange}
      />

      <div className="border-t border-muted-line/10 pt-8" />

      <ClientDetailsSection
        data={data.clientDetails}
        onChange={onClientDetailsChange}
      />

      <div className="border-t border-muted-line/10 pt-8" />

      <InvoiceDetailsSection
        data={data.invoiceDetails}
        onChange={onInvoiceDetailsChange}
      />

      <div className="border-t border-muted-line/10 pt-8" />

      <LineItemsSection
        items={data.lineItems}
        taxMode={data.taxMode}
        onTaxModeChange={onTaxModeChange}
        onAddItem={onAddLineItem}
        onRemoveItem={onRemoveLineItem}
        onUpdateItem={onUpdateLineItem}
      />

      <div className="border-t border-muted-line/10 pt-8" />

      <BankDetailsSection
        data={data.bankDetails}
        onChange={onBankDetailsChange}
      />

      <div className="border-t border-muted-line/10 pt-8" />

      <NotesAndTermsSection
        notes={data.notes}
        terms={data.terms}
        onNotesChange={onNotesChange}
        onTermsChange={onTermsChange}
      />
    </div>
  );
}
