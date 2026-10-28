// Shared shop data for the POS assistant tests.

import type { AssistantData } from "@/lib/pos/assistant/agent";
import { DEFAULT_SETTINGS, type Order, type OrderItem, type Product } from "@/lib/pos/types";

export const NOW = new Date(2026, 9, 27, 15, 0); // Tue 27 Oct 2026, 3 pm local

function product(id: string, name: string, price: number, extra: Partial<Product> = {}): Product {
  return {
    id,
    name,
    sellingPrice: price,
    sku: "",
    barcode: "",
    categoryId: "",
    costPrice: null,
    taxRate: null,
    taxInclusive: false,
    trackStock: true,
    stock: 20,
    unit: "",
    imageDataUrl: "",
    description: "",
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

function order(id: string, invoiceNumber: string, date: Date, total: number, extra: Partial<Order> = {}): Order {
  return {
    id,
    invoiceNumber,
    date: date.toISOString(),
    customerId: null,
    customerName: "",
    subtotal: total,
    discountType: "flat",
    discountValue: 0,
    discountAmount: 0,
    taxAmount: 0,
    includedTaxAmount: 0,
    total,
    paymentMethodId: "cash",
    paymentMethodName: "Cash",
    status: "completed",
    createdAt: date.toISOString(),
    ...extra,
  };
}

function item(orderId: string, productId: string, name: string, quantity: number, price: number): OrderItem {
  return {
    id: `${orderId}-${productId}`,
    orderId,
    productId,
    name,
    price,
    quantity,
    unit: "",
    taxRate: 0,
    taxInclusive: false,
    lineSubtotal: price * quantity,
  };
}

const today = new Date(2026, 9, 27, 10, 0);
const yesterday = new Date(2026, 9, 26, 18, 0);

export const data: AssistantData = {
  business: {
    id: "main",
    name: "Sharma Kirana",
    phone: "",
    address: "",
    currency: "INR",
    email: "",
    taxNumber: "",
    logoDataUrl: "",
    createdAt: "",
  },
  settings: { ...DEFAULT_SETTINGS },
  products: [
    product("maggi", "Maggi Noodles 70g", 14, { costPrice: 11, stock: 3 }),
    product("coke", "Coke 500ml", 40, { costPrice: 30 }),
    product("parle", "Parle-G Biscuit 100g", 10, { stock: 0 }),
    product("amul-butter", "Amul Butter 100g", 58),
    product("amul-milk", "Amul Milk 500ml", 32),
    product("pen", "Reynolds Pen", 10, { trackStock: false, stock: 0, sku: "PEN01" }),
  ],
  customers: [
    { id: "ramesh", name: "Ramesh Kumar", phone: "9876543210", email: "", address: "", notes: "", createdAt: "" },
    { id: "sita", name: "Sita Devi", phone: "9123456780", email: "", address: "", notes: "", createdAt: "" },
  ],
  orders: [
    order("o1", "INV-00001", yesterday, 68),
    order("o2", "INV-00002", today, 80, { paymentMethodId: "upi", paymentMethodName: "UPI", customerId: "ramesh", customerName: "Ramesh Kumar" }),
    order("o3", "INV-00003", today, 28),
    order("o4", "INV-00004", today, 500, { status: "cancelled" }),
  ],
  orderItems: [
    item("o1", "maggi", "Maggi Noodles 70g", 2, 14),
    item("o1", "coke", "Coke 500ml", 1, 40),
    item("o2", "coke", "Coke 500ml", 2, 40),
    item("o3", "maggi", "Maggi Noodles 70g", 2, 14),
    item("o4", "coke", "Coke 500ml", 12, 40),
  ],
  payments: [
    { id: "cash", name: "Cash", isDefault: true, createdAt: "" },
    { id: "upi", name: "UPI", isDefault: true, createdAt: "" },
    { id: "card", name: "Card", isDefault: true, createdAt: "" },
  ],
};
