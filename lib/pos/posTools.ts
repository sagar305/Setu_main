// Tools that can attach to POS data.
//
// Every tool listed here reads (or writes) the same workspace database the POS
// uses, so switching one on means it already has your sales, customers,
// products or suppliers the moment you open it — nothing to re-type.
//
// A few also unlock behaviour inside the POS itself (`unlocks`): enabling
// Customer Ledger, for example, is what puts the Credit (Udhaar) payment
// option on the billing screen. Tools without `unlocks` simply consume POS
// data; listing them here is how a shop owner discovers what's available.

export type PosToolCategory = "Sales & billing" | "Money in" | "Money out" | "Reports & analysis";

export type PosToolLink = {
  /** Stable slug stored in PosSettings.connectedTools. */
  slug: string;
  name: string;
  route: string;
  category: PosToolCategory;
  /** One line on what the tool does. */
  description: string;
  /** What POS data flows into it, in plain language. */
  usesPosData: string;
  /** POS behaviour this unlocks when enabled; omitted if it only reads data. */
  unlocks?: string;
};

export const POS_TOOLS: PosToolLink[] = [
  // ---- Sales & billing ----------------------------------------------------
  {
    slug: "receipt-designer",
    name: "Receipt Generator",
    route: "/tools/receipt-designer",
    category: "Sales & billing",
    description: "Design your receipt and print one for any sale.",
    usesPosData: "Your business details and logo; saved designs print from the POS.",
    unlocks: "Saved receipt designs become printing options at checkout.",
  },

  // ---- Money in -----------------------------------------------------------
  {
    slug: "customer-ledger",
    name: "Customer Ledger (Udhaar)",
    route: "/tools/customer-ledger",
    category: "Money in",
    description: "Track credit given and payments received, per customer.",
    usesPosData: "The same customer book as the POS; credit sales post here automatically.",
    unlocks: "Adds the Credit (Udhaar) payment option at checkout for saved customers.",
  },
  {
    slug: "invoice-aging-report",
    name: "Invoice Aging Report",
    route: "/tools/invoice-aging-report",
    category: "Money in",
    description: "See who owes you, how much, and how overdue.",
    usesPosData: "Outstanding balances from your customer ledger.",
  },

  // ---- Money out ----------------------------------------------------------
  {
    slug: "expense-tracker",
    name: "Expense Tracker",
    route: "/tools/expense-tracker",
    category: "Money out",
    description: "Record what the shop spends, by category.",
    usesPosData: "Your business details and suppliers; feeds the profit dashboard.",
  },
  {
    slug: "purchase-register",
    name: "Purchase Register",
    route: "/tools/purchase-register",
    category: "Money out",
    description: "Log supplier bills and update stock from them.",
    usesPosData: "Saved suppliers and products; purchases can top up POS stock.",
  },
  {
    slug: "supplier-book",
    name: "Supplier Book",
    route: "/tools/supplier-book",
    category: "Money out",
    description: "Keep supplier contacts and GSTINs in one place.",
    usesPosData: "Shared with every purchase document you raise.",
  },
  {
    slug: "supplier-ledger",
    name: "Supplier Ledger",
    route: "/tools/supplier-ledger",
    category: "Money out",
    description: "Track what you owe each supplier and the payments you make.",
    usesPosData:
      "The same supplier book; credit purchases from the Purchase Register post here automatically.",
  },
  {
    slug: "accounts-payable-aging",
    name: "Accounts Payable Aging",
    route: "/tools/accounts-payable-aging",
    category: "Money out",
    description: "See which unpaid supplier bills are due and how overdue.",
    usesPosData: "Unpaid credit purchases from the Purchase Register, net of payments in the Supplier Ledger.",
  },

  // ---- Reports & analysis -------------------------------------------------
  {
    slug: "profit-dashboard",
    name: "Profit Dashboard",
    route: "/tools/profit-dashboard",
    category: "Reports & analysis",
    description: "Sales minus real expenses — actual profit.",
    usesPosData: "POS sales plus your recorded expenses.",
  },
  {
    slug: "stock-register",
    name: "Stock Register",
    route: "/tools/stock-register",
    category: "Reports & analysis",
    description: "Track stock levels and movements.",
    usesPosData: "The same products and stock the POS sells from.",
  },
  {
    slug: "barcode-generator",
    name: "Barcode Generator",
    route: "/tools/barcode-generator",
    category: "Reports & analysis",
    description: "Generate scannable barcodes for your products.",
    usesPosData: "Your saved products and their codes.",
  },
];

export const POS_TOOL_CATEGORIES: PosToolCategory[] = [
  "Sales & billing",
  "Money in",
  "Money out",
  "Reports & analysis",
];

/** Is this tool switched on for the POS? */
export function isToolEnabled(connectedTools: string[] | undefined, slug: string): boolean {
  return (connectedTools ?? []).includes(slug);
}
