import { formatCurrency, formatNumber, parseNumber } from "@/lib/format";
import type {
  InvoiceData,
  InvoiceTotals,
  LineItem,
  LineItemCalculated,
} from "@/lib/types/invoice";

export function calculateLineItem(
  item: LineItem,
  taxMode: "inclusive" | "exclusive"
): LineItemCalculated {
  const quantity = Math.max(0, item.quantity);
  const rate = Math.max(0, item.rate);
  const discountPercent = Math.max(0, Math.min(100, item.discountPercent));
  const taxRate = Math.max(0, item.taxRate);

  const baseAmount = quantity * rate;
  const discountAmount = (baseAmount * discountPercent) / 100;
  const amountAfterDiscount = baseAmount - discountAmount;

  let taxableAmount: number;
  let taxAmount: number;
  let amount: number;

  if (taxMode === "inclusive") {
    // Tax is already included in the rate
    taxableAmount = amountAfterDiscount / (1 + taxRate / 100);
    taxAmount = amountAfterDiscount - taxableAmount;
    amount = amountAfterDiscount;
  } else {
    // Tax is exclusive
    taxableAmount = amountAfterDiscount;
    taxAmount = (amountAfterDiscount * taxRate) / 100;
    amount = amountAfterDiscount + taxAmount;
  }

  return {
    ...item,
    discountAmount: Math.round(discountAmount * 100) / 100,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    amount: Math.round(amount * 100) / 100,
  };
}

export function calculateTotals(
  lineItems: LineItem[],
  taxMode: "inclusive" | "exclusive"
): InvoiceTotals {
  const calculated = lineItems.map((item) => calculateLineItem(item, taxMode));

  const subtotal = calculated.reduce((sum, item) => sum + item.taxableAmount, 0);
  const totalDiscount = calculated.reduce((sum, item) => sum + item.discountAmount, 0);
  const totalTax = calculated.reduce((sum, item) => sum + item.taxAmount, 0);
  const grandTotal = calculated.reduce((sum, item) => sum + item.amount, 0);

  // Group tax by rate
  const taxByRate: Record<number, number> = {};
  calculated.forEach((item) => {
    const rate = item.taxRate;
    taxByRate[rate] = (taxByRate[rate] || 0) + item.taxAmount;
  });

  // Round all values
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    taxByRate: Object.fromEntries(
      Object.entries(taxByRate).map(([rate, amount]) => [
        rate,
        Math.round(amount * 100) / 100,
      ])
    ),
    totalTax: Math.round(totalTax * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
  };
}

export function amountInWordsIndian(amount: number): string {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
  ];
  const teens = [
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const scales = ["", "Thousand", "Lakh", "Crore"];

  if (amount === 0) return "Zero Rupees Only";
  if (amount < 0) return "Negative " + amountInWordsIndian(-amount);

  const croreValue = Math.floor(amount / 10000000);
  const lakhValue = Math.floor((amount % 10000000) / 100000);
  const thousandValue = Math.floor((amount % 100000) / 1000);
  const remainingValue = Math.floor(amount % 1000);

  const parts: string[] = [];

  if (croreValue > 0) {
    parts.push(convertHundreds(croreValue) + " Crore");
  }

  if (lakhValue > 0) {
    parts.push(convertHundreds(lakhValue) + " Lakh");
  }

  if (thousandValue > 0) {
    parts.push(convertHundreds(thousandValue) + " Thousand");
  }

  if (remainingValue > 0) {
    parts.push(convertHundreds(remainingValue));
  }

  return parts.join(" ") + " Rupees Only";
}

function convertHundreds(num: number): string {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
  ];
  const teens = [
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  if (num === 0) return "";

  const hundred = Math.floor(num / 100);
  const remainder = num % 100;

  let result = "";

  if (hundred > 0) {
    result += ones[hundred] + " Hundred";
  }

  if (remainder >= 20) {
    if (result) result += " ";
    const ten = Math.floor(remainder / 10);
    const one = remainder % 10;
    result += tens[ten];
    if (one > 0) {
      result += " " + ones[one];
    }
  } else if (remainder > 0) {
    if (result) result += " ";
    result += remainder < 10 ? ones[remainder] : teens[remainder - 10];
  }

  return result;
}

export function validateGSTIN(gstin: string): boolean {
  if (!gstin) return true; // Optional field
  // Basic GSTIN format: 2 digits (state) + 10 alphanumeric (PAN) + 1 digit (entity) + 1 alphanumeric (checksum)
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin.toUpperCase());
}

export function determineTaxType(
  businessState?: string,
  clientState?: string
): "cgst_sgst" | "igst" {
  // If states are same or not provided, assume CGST/SGST (default)
  if (!businessState || !clientState) return "cgst_sgst";
  if (businessState.toLowerCase() === clientState.toLowerCase())
    return "cgst_sgst";
  return "igst";
}

export function splitTax(
  taxAmount: number,
  taxType: "cgst_sgst" | "igst"
): { cgst: number; sgst: number; igst: number } {
  if (taxType === "igst") {
    return {
      cgst: 0,
      sgst: 0,
      igst: Math.round(taxAmount * 100) / 100,
    };
  }

  const half = Math.round((taxAmount / 2) * 100) / 100;
  return {
    cgst: half,
    sgst: Math.round((taxAmount - half) * 100) / 100,
    igst: 0,
  };
}

export function formatInvoiceNumber(number: string): string {
  return number.toUpperCase().replace(/\s+/g, "");
}

export function getInvoiceFileName(invoiceNumber: string, date: string): string {
  const dateStr = date.replace(/-/g, "");
  return `Invoice-${invoiceNumber}-${dateStr}.pdf`;
}
