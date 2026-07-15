export interface BusinessDetails {
  name: string;
  logo?: string;
  address: string;
  phone: string;
  email: string;
  gstin?: string;
}

export interface ClientDetails {
  name: string;
  address: string;
  phone?: string;
  email?: string;
  gstin?: string;
}

export interface BankDetails {
  accountNo?: string;
  ifsc?: string;
  upiId?: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  discountPercent: number;
  taxRate: number;
}

export interface InvoiceDetails {
  number: string;
  date: string;
  dueDate: string;
  poNumber?: string;
  ewayBillNumber?: string;
}

export interface InvoiceData {
  businessDetails: BusinessDetails;
  clientDetails: ClientDetails;
  invoiceDetails: InvoiceDetails;
  lineItems: LineItem[];
  bankDetails?: BankDetails;
  notes: string;
  terms: string;
  template: "classic" | "modern" | "colorful";
  brandColor: string;
  taxMode: "inclusive" | "exclusive";
}

export interface InvoiceTotals {
  subtotal: number;
  totalDiscount: number;
  taxByRate: Record<number, number>;
  totalTax: number;
  grandTotal: number;
}

export interface LineItemCalculated extends LineItem {
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  amount: number;
}
