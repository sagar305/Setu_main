// Carries out an action the user has confirmed.
//
// It goes through the POS store's own functions — the same ones the screens
// call — so an assistant sale gets an invoice number, reduces stock, posts
// udhaar to the ledger and marks Sheet sync dirty exactly like a sale rung up
// by hand. Nothing here writes to the database directly.

import type { CheckoutInput, CustomerInput, ProductInput } from "@/lib/pos/store";
import { formatMoney, type Customer, type Order, type Product } from "@/lib/pos/types";
import type { AgentAction, AgentReply } from "./agent";

/** The slice of the POS store the assistant is allowed to use. */
export type AssistantApi = {
  currency: string;
  products: Product[];
  orders: Order[];
  checkout: (input: CheckoutInput) => Promise<Order>;
  adjustStock: (productId: string, type: "add" | "reduce" | "adjust", quantity: number, note?: string) => Promise<void>;
  updateProduct: (id: string, input: ProductInput) => Promise<void>;
  createProduct: (input: ProductInput) => Promise<Product>;
  createCustomer: (input: CustomerInput) => Promise<Customer>;
  cancelOrder: (orderId: string) => Promise<void>;
  exportBackup: () => Promise<void>;
};

/** What a confirmed action produced: a reply, and a receipt to show if it was a sale. */
export type ExecutionResult = { reply: AgentReply; order?: Order };

const NOTE = "via assistant";

function productInput(product: Product): ProductInput {
  return {
    name: product.name,
    sellingPrice: product.sellingPrice,
    sku: product.sku,
    barcode: product.barcode,
    categoryId: product.categoryId,
    costPrice: product.costPrice,
    taxRate: product.taxRate,
    taxInclusive: product.taxInclusive,
    trackStock: product.trackStock,
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold ?? null,
    unit: product.unit,
    imageDataUrl: product.imageDataUrl,
    description: product.description,
  };
}

export async function executeAction(action: AgentAction, api: AssistantApi): Promise<ExecutionResult> {
  switch (action.kind) {
    case "sale": {
      const order = await api.checkout({
        lines: action.lines,
        discountType: "flat",
        discountValue: 0,
        customerId: action.customerId,
        paymentMethodId: action.paymentMethodId,
        creditSale: action.creditSale,
      });
      return {
        order,
        reply: {
          text: `Done — ${order.invoiceNumber} recorded for ${formatMoney(order.total, api.currency)}.`,
          suggestions: [`cancel ${order.invoiceNumber}`, "Today's sales"],
        },
      };
    }

    case "stock": {
      const product = api.products.find((p) => p.id === action.productId);
      if (!product) throw new Error("That product no longer exists.");
      await api.adjustStock(product.id, action.mode, action.quantity, NOTE);
      const before = product.trackStock ? product.stock : 0;
      const after =
        action.mode === "add" ? before + action.quantity : action.mode === "reduce" ? before - action.quantity : action.quantity;
      return { reply: { text: `Updated — ${product.name} now has ${after} in stock.` } };
    }

    case "price": {
      const product = api.products.find((p) => p.id === action.productId);
      if (!product) throw new Error("That product no longer exists.");
      await api.updateProduct(product.id, { ...productInput(product), sellingPrice: action.price });
      return { reply: { text: `Updated — ${product.name} now sells at ${formatMoney(action.price, api.currency)}.` } };
    }

    case "add-product": {
      const product = await api.createProduct({
        name: action.name,
        sellingPrice: action.price,
        sku: "",
        barcode: "",
        categoryId: "",
        costPrice: null,
        taxRate: null,
        taxInclusive: false,
        trackStock: action.stock !== null,
        stock: action.stock ?? 0,
        lowStockThreshold: null,
        unit: "",
        imageDataUrl: "",
        description: "",
      });
      return {
        reply: {
          text: `Added ${product.name} at ${formatMoney(product.sellingPrice, api.currency)}.`,
          link: { screen: "products", query: product.name, label: "Edit details" },
          suggestions: [`sell 1 ${product.name} by cash`],
        },
      };
    }

    case "add-customer": {
      const customer = await api.createCustomer({ name: action.name, phone: action.phone, email: "", address: "", notes: "" });
      return {
        reply: {
          text: `Saved ${customer.name}.`,
          link: { screen: "customers", query: customer.name, label: "Show customer" },
        },
      };
    }

    case "cancel-order": {
      const order = api.orders.find((o) => o.id === action.orderId);
      if (!order) throw new Error("That bill no longer exists.");
      await api.cancelOrder(order.id);
      return { reply: { text: `${order.invoiceNumber} cancelled and its stock restored.` } };
    }

    case "backup": {
      await api.exportBackup();
      return { reply: { text: "Backup downloaded. Keep the file somewhere safe — it restores everything." } };
    }
  }
}
