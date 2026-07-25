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
    slug: "invoice-generator",
    name: "Invoice Generator",
    route: "/tools/invoice-generator",
    category: "Sales & billing",
    description: "Raise a proper GST invoice for a customer.",
    usesPosData: "Your business details, saved customers and products.",
  },
  {
    slug: "quotation-generator",
    name: "Quotation Generator",
    route: "/tools/quotation-generator",
    category: "Sales & billing",
    description: "Send a polished quote before the sale.",
    usesPosData: "Your business details, saved customers and products.",
  },
  {
    slug: "receipt-designer",
    name: "Receipt Generator",
    route: "/tools/receipt-designer",
    category: "Sales & billing",
    description: "Design your receipt and print one for any sale.",
    usesPosData: "Your business details and logo; saved designs print from the POS.",
    unlocks: "Saved receipt designs become printing options at checkout.",
  },
  {
    slug: "sales-order-generator",
    name: "Sales Order Generator",
    route: "/tools/sales-order-generator",
    category: "Sales & billing",
    description: "Confirm a customer order before you dispatch it.",
    usesPosData: "Your business details, saved customers and products.",
  },
  {
    slug: "credit-note-generator",
    name: "Credit Note Generator",
    route: "/tools/credit-note-generator",
    category: "Sales & billing",
    description: "Handle returns and billing adjustments.",
    usesPosData: "Your business details, saved customers and products.",
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
    slug: "customer-statement",
    name: "Customer Statement",
    route: "/tools/customer-statement",
    category: "Money in",
    description: "Send a statement of account to a customer.",
    usesPosData: "Saved customers and their ledger transactions.",
  },
  {
    slug: "invoice-aging-report",
    name: "Invoice Aging Report",
    route: "/tools/invoice-aging-report",
    category: "Money in",
    description: "See who owes you, how much, and how overdue.",
    usesPosData: "Outstanding balances from your customer ledger.",
  },
  {
    slug: "upi-qr-generator",
    name: "UPI QR Generator",
    route: "/tools/upi-qr-generator",
    category: "Money in",
    description: "Print a UPI QR so customers can pay by phone.",
    usesPosData: "Your business UPI ID and name.",
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
    slug: "cash-book",
    name: "Cash Book",
    route: "/tools/cash-book",
    category: "Money out",
    description: "Daily cash in, cash out and closing balance.",
    usesPosData: "Your business details; pair with POS cash sales for a full day-book.",
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
    slug: "purchase-order-generator",
    name: "Purchase Order Generator",
    route: "/tools/purchase-order-generator",
    category: "Money out",
    description: "Order stock from a supplier, formally.",
    usesPosData: "Your business details, saved suppliers and products.",
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
    slug: "accounts-payable-aging",
    name: "Accounts Payable Aging",
    route: "/tools/accounts-payable-aging",
    category: "Money out",
    description: "See which supplier bills to pay first.",
    usesPosData: "Unpaid bills from your purchase register.",
  },
  {
    slug: "debit-note-generator",
    name: "Debit Note Generator",
    route: "/tools/debit-note-generator",
    category: "Money out",
    description: "Raise a debit note for returns or short supply.",
    usesPosData: "Your business details, saved suppliers and products.",
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
    slug: "profit-loss-statement",
    name: "Profit & Loss Statement",
    route: "/tools/profit-loss-statement",
    category: "Reports & analysis",
    description: "A full P&L you can print or hand to your CA.",
    usesPosData: "Revenue from POS sales, costs from purchases and expenses.",
  },
  {
    slug: "balance-sheet",
    name: "Balance Sheet",
    route: "/tools/balance-sheet",
    category: "Reports & analysis",
    description: "What you own, owe and what's left over.",
    usesPosData: "Cash from your cash book, receivables from the customer ledger.",
  },
  {
    slug: "cash-flow-statement",
    name: "Cash Flow Statement",
    route: "/tools/cash-flow-statement",
    category: "Reports & analysis",
    description: "Where the cash actually came from and went.",
    usesPosData: "Your recorded cash book entries.",
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
    slug: "abc-analysis",
    name: "ABC Analysis",
    route: "/tools/abc-analysis",
    category: "Reports & analysis",
    description: "Find the few items that drive most of your stock value.",
    usesPosData: "Your product list and costs.",
  },
  {
    slug: "budget-vs-actual",
    name: "Budget vs Actual",
    route: "/tools/budget-vs-actual",
    category: "Reports & analysis",
    description: "Compare what you planned to spend against reality.",
    usesPosData: "Actual spend pulled from your expense categories.",
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
