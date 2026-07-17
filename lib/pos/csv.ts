import type {
  Category,
  Customer,
  InventoryLog,
  Order,
  OrderItem,
  Product,
} from "./types";

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  // BOM so Excel opens UTF-8 (₹, names in Indic scripts) correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function productsCsv(products: Product[], categories: Category[]): string {
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";
  return toCsv(
    ["Name", "SKU", "Barcode", "Category", "Selling Price", "Cost Price", "Tax %", "Tax Type", "Stock", "Unit", "Description"],
    products.map((p) => [
      p.name,
      p.sku,
      p.barcode,
      categoryName(p.categoryId),
      p.sellingPrice,
      p.costPrice ?? "",
      p.taxRate ?? "",
      p.taxInclusive ? "inclusive" : "exclusive",
      p.trackStock ? p.stock : "",
      p.unit,
      p.description,
    ])
  );
}

export function customersCsv(customers: Customer[]): string {
  return toCsv(
    ["Name", "Phone", "Email", "Address", "Notes"],
    customers.map((c) => [c.name, c.phone, c.email, c.address, c.notes])
  );
}

export function ordersCsv(orders: Order[]): string {
  return toCsv(
    ["Invoice Number", "Date", "Customer", "Subtotal", "Discount", "Tax", "Included Tax", "Total", "Payment Method", "Status"],
    orders.map((o) => [
      o.invoiceNumber,
      new Date(o.date).toLocaleString(),
      o.customerName || "Walk-in",
      o.subtotal,
      o.discountAmount,
      o.taxAmount,
      o.includedTaxAmount ?? 0,
      o.total,
      o.paymentMethodName,
      o.status,
    ])
  );
}

export function salesReportCsv(orders: Order[], orderItems: OrderItem[]): string {
  const rows: unknown[][] = [];
  for (const order of orders) {
    const items = orderItems.filter((item) => item.orderId === order.id);
    for (const item of items) {
      rows.push([
        order.invoiceNumber,
        new Date(order.date).toLocaleString(),
        order.customerName || "Walk-in",
        item.name,
        item.quantity,
        item.price,
        item.lineSubtotal,
        order.paymentMethodName,
        order.status,
      ]);
    }
  }
  return toCsv(
    ["Invoice Number", "Date", "Customer", "Product", "Quantity", "Price", "Line Total", "Payment Method", "Status"],
    rows
  );
}

export function inventoryCsv(logs: InventoryLog[]): string {
  return toCsv(
    ["Date", "Product", "Type", "Change", "Stock After", "Note"],
    logs.map((log) => [
      new Date(log.createdAt).toLocaleString(),
      log.productName,
      log.type,
      log.change,
      log.stockAfter,
      log.note,
    ])
  );
}
