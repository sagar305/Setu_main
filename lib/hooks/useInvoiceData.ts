"use client";

import { useEffect, useState } from "react";
import type { InvoiceData, LineItem, BusinessDetails, ClientDetails, InvoiceDetails, BankDetails } from "@/lib/types/invoice";

const DEFAULT_INVOICE_DATA: InvoiceData = {
  businessDetails: {
    name: "",
    address: "",
    phone: "",
    email: "",
    gstin: "",
  },
  clientDetails: {
    name: "",
    address: "",
    phone: "",
    email: "",
    gstin: "",
  },
  invoiceDetails: {
    number: "INV-001",
    date: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    poNumber: "",
    ewayBillNumber: "",
  },
  lineItems: [
    {
      id: "1",
      description: "",
      quantity: 1,
      unit: "Qty",
      rate: 0,
      discountPercent: 0,
      taxRate: 18,
    },
  ],
  bankDetails: {
    accountNo: "",
    ifsc: "",
    upiId: "",
  },
  notes: "",
  terms: "",
  template: "classic",
  brandColor: "#26306B",
  taxMode: "exclusive",
};

const STORAGE_KEY = "invoice_generator_data";

export function useInvoiceData() {
  const [data, setData] = useState<InvoiceData>(DEFAULT_INVOICE_DATA);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setData({
          ...DEFAULT_INVOICE_DATA,
          ...parsed,
        });
      } catch {
        // If parsing fails, use defaults
        setData(DEFAULT_INVOICE_DATA);
      }
    } else {
      setData(DEFAULT_INVOICE_DATA);
    }
    setIsLoaded(true);
  }, []);

  // Auto-save to localStorage whenever data changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [data, isLoaded]);

  const updateBusinessDetails = (details: Partial<BusinessDetails>) => {
    setData((prev) => ({
      ...prev,
      businessDetails: { ...prev.businessDetails, ...details },
    }));
  };

  const updateClientDetails = (details: Partial<ClientDetails>) => {
    setData((prev) => ({
      ...prev,
      clientDetails: { ...prev.clientDetails, ...details },
    }));
  };

  const updateInvoiceDetails = (details: Partial<InvoiceDetails>) => {
    setData((prev) => ({
      ...prev,
      invoiceDetails: { ...prev.invoiceDetails, ...details },
    }));
  };

  const updateBankDetails = (details: Partial<BankDetails>) => {
    setData((prev) => ({
      ...prev,
      bankDetails: { ...prev.bankDetails, ...details },
    }));
  };

  const addLineItem = () => {
    const newId = String(Math.max(...data.lineItems.map((item) => parseInt(item.id) || 0), 0) + 1);
    setData((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        {
          id: newId,
          description: "",
          quantity: 1,
          unit: "Qty",
          rate: 0,
          discountPercent: 0,
          taxRate: 18,
        },
      ],
    }));
  };

  const removeLineItem = (id: string) => {
    if (data.lineItems.length > 1) {
      setData((prev) => ({
        ...prev,
        lineItems: prev.lineItems.filter((item) => item.id !== id),
      }));
    }
  };

  const updateLineItem = (id: string, updates: Partial<LineItem>) => {
    setData((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  };

  const updateNotes = (notes: string) => {
    setData((prev) => ({ ...prev, notes }));
  };

  const updateTerms = (terms: string) => {
    setData((prev) => ({ ...prev, terms }));
  };

  const updateTemplate = (template: "classic" | "modern" | "colorful") => {
    setData((prev) => ({ ...prev, template }));
  };

  const updateBrandColor = (color: string) => {
    setData((prev) => ({ ...prev, brandColor: color }));
  };

  const updateTaxMode = (mode: "inclusive" | "exclusive") => {
    setData((prev) => ({ ...prev, taxMode: mode }));
  };

  const reset = () => {
    setData(DEFAULT_INVOICE_DATA);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
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
    updateTaxMode,
    reset,
  };
}
