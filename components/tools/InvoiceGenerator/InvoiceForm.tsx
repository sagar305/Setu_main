"use client";

import { useState } from "react";
import { BusinessDetailsSection } from "./BusinessDetailsSection";
import { ClientDetailsSection } from "./ClientDetailsSection";
import { InvoiceDetailsSection } from "./InvoiceDetailsSection";
import { LineItemsSection } from "./LineItemsSection";
import { NotesAndTermsSection } from "./NotesAndTermsSection";
import { BankDetailsSection } from "./BankDetailsSection";
import type { InvoiceData } from "@/lib/types/invoice";

interface InvoiceFormProps {
  data: InvoiceData;
  onBusinessDetailsChange: (data: Parameters<typeof BusinessDetailsSection>["0"]["onChange"]>) => void;
  onClientDetailsChange: (data: Parameters<typeof ClientDetailsSection>["0"]["onChange"]>) => void;
  onInvoiceDetailsChange: (data: Parameters<typeof InvoiceDetailsSection>["0"]["onChange"]>) => void;
  onBankDetailsChange: (data: Parameters<typeof BankDetailsSection>["0"]["onChange"]>) => void;
  onAddLineItem: () => void;
  onRemoveLineItem: (id: string) => void;
  onUpdateLineItem: (id: string, updates: Parameters<typeof LineItemsSection>["0"]["onUpdateItem"]) => void;
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
  onNotesChange,
  onTermsChange,
}: InvoiceFormProps) {
  const [showBankDetails, setShowBankDetails] = useState(false);

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
        onAddItem={onAddLineItem}
        onRemoveItem={onRemoveLineItem}
        onUpdateItem={onUpdateLineItem}
      />

      <div className="border-t border-muted-line/10 pt-8" />

      <BankDetailsSection
        data={data.bankDetails}
        isVisible={showBankDetails}
        onVisibilityChange={setShowBankDetails}
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
