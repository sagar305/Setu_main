// Setu Business Toolkit — Tool Registry
// ---------------------------------------------------------------------------
// One machine-readable source of truth for the product roadmap (Chapter 2) AND
// the integration catalog (Chapter 6). The prose tables in
// docs/setu-business-toolkit.md are VIEWS of this data — they should be
// generated from it, never maintained by hand in parallel.
//
// The same registry also powers in-app "Suggested tools" discovery: given the
// tool a user is in, suggestedTools() returns the related tools declared here.
//
// A tool must never depend on this registry to *function* — it is metadata for
// discovery, docs and roadmap only. Stripping it away must not break any tool
// (the "shell is chrome, never a dependency" rule).

import type { EntityName } from "@/lib/toolkit/entities";

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** Stable slug for every current and planned tool. Also used as ToolSlug refs. */
export type ToolSlug =
  // Business identity
  | "business-profile"
  | "logo-manager"
  | "brand-kit"
  // Sales & billing
  | "browser-pos"
  | "invoice-generator"
  | "receipt-designer"
  | "quotation-generator"
  | "credit-note-generator"
  | "delivery-challan"
  | "payment-link-generator"
  // Product management
  | "product-catalog"
  | "barcode-generator"
  | "label-printer"
  | "shelf-label-generator"
  | "bulk-product-import"
  // Customer management
  | "customer-book"
  | "supplier-book"
  | "customer-ledger"
  | "loyalty-card"
  // Inventory
  | "stock-register"
  | "purchase-register"
  // Finance
  | "expense-tracker"
  | "cash-book"
  | "profit-dashboard"
  | "gst-reports"
  // Restaurant
  | "qr-menu-generator"
  | "kitchen-order-board"
  | "recipe-manager"
  // Service businesses
  | "appointment-book"
  | "queue-management"
  // Payments / utilities
  | "upi-qr-generator"
  | "gst-calculator"
  // Documents
  | "pdf-tools"
  | "credit-note-generator"
  | "debit-note-generator"
  | "purchase-order-generator"
  | "sales-order-generator"
  // Bookkeeping
  | "chart-of-accounts"
  | "journal-entry"
  | "general-ledger"
  | "bank-reconciliation"
  | "trial-balance"
  // Statements & reports
  | "profit-loss-statement"
  | "balance-sheet"
  | "cash-flow-statement"
  | "customer-statement"
  | "invoice-aging-report"
  | "accounts-payable-aging"
  // Financial analysis
  | "budget-vs-actual"
  | "abc-analysis"
  | "vendor-comparison"
  // AI (future)
  | "receipt-ocr";

/** Roadmap tier — the sequencing spine (Q10). */
export type ToolTier = "foundation" | "growth" | "future" | "ideas";

/** Build status, independent of tier. */
export type ToolStatus = "built" | "next" | "planned" | "idea";

/**
 * What kind of surface this is. Not everything on the roadmap is a destination
 * app — some are workspace config, some are features of another tool. Only
 * "app" entries get their own route.
 */
export type ToolKind = "app" | "workspace-surface" | "feature";

export type ToolCategory =
  | "business-identity"
  | "sales-billing"
  | "product-management"
  | "customer-management"
  | "inventory"
  | "finance"
  | "restaurant"
  | "service"
  | "payments"
  | "documents"
  | "ai";

/** Which paid Setu product this tool naturally leads a user toward (Q1). */
export type PaidPath = "restaurant-pos" | "retail-pos" | "clinic" | "queue" | "platform";

export type Integration = {
  /** The other tool involved. */
  with: ToolSlug;
  /** One line describing the better-UX outcome (Chapter 6 catalog cell). */
  ux: string;
};

export type ToolDescriptor = {
  slug: ToolSlug;
  name: string;
  category: ToolCategory;
  kind: ToolKind;
  tier: ToolTier;
  status: ToolStatus;
  /** Route if it is an "app"; omitted for surfaces/features. */
  route?: string;
  /** The single entity this tool is the primary editor of, if any. */
  owns?: EntityName;
  reads: EntityName[];
  writes: EntityName[];
  /** Tools that must exist first (data dependency graph). */
  dependsOn: ToolSlug[];
  /** Which paid product this tool funnels toward. */
  paidPath: PaidPath;
  integrations: Integration[];
};

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------
// Built + Foundation + Growth tools are specified richly. Future/Ideas are
// listed so developers know the ecosystem vocabulary, with lighter metadata.

export const TOOLKIT_REGISTRY: ToolDescriptor[] = [
  // ---- Foundation ---------------------------------------------------------
  {
    slug: "business-profile",
    name: "Business Profile",
    category: "business-identity",
    kind: "workspace-surface",
    tier: "foundation",
    status: "built",
    route: "/tools/business-profile",
    owns: "business",
    reads: ["business"],
    writes: ["business"],
    dependsOn: [],
    paidPath: "platform",
    integrations: [{ with: "browser-pos", ux: "Auto-fills business details into every tool" }],
  },
  {
    slug: "logo-manager",
    name: "Logo Manager",
    category: "business-identity",
    kind: "workspace-surface",
    tier: "foundation",
    status: "planned",
    owns: "assets",
    reads: ["assets", "business"],
    writes: ["assets"],
    dependsOn: ["business-profile"],
    paidPath: "platform",
    integrations: [{ with: "invoice-generator", ux: "Same logo on every document" }],
  },
  {
    slug: "receipt-designer",
    name: "Receipt Generator",
    category: "sales-billing",
    kind: "app",
    tier: "foundation",
    status: "built",
    route: "/tools/receipt-designer",
    owns: "receipt_templates",
    reads: ["business", "assets"],
    writes: ["receipt_templates"],
    dependsOn: ["business-profile"],
    paidPath: "platform",
    integrations: [
      { with: "browser-pos", ux: "POS prints bills using a saved receipt template" },
      { with: "invoice-generator", ux: "Invoice reuses the same branding and layout" },
    ],
  },
  {
    slug: "expense-tracker",
    name: "Expense Tracker",
    category: "finance",
    kind: "app",
    tier: "foundation",
    status: "built",
    route: "/tools/expense-tracker",
    owns: "expenses",
    reads: ["business", "suppliers"],
    writes: ["expenses"],
    dependsOn: ["business-profile"],
    paidPath: "platform",
    integrations: [
      { with: "profit-dashboard", ux: "Profit uses actual recorded expenses" },
      { with: "invoice-generator", ux: "Mark a purchase invoice as an expense" },
    ],
  },
  {
    slug: "cash-book",
    name: "Cash Book",
    category: "finance",
    kind: "app",
    tier: "foundation",
    status: "built",
    route: "/tools/cash-book",
    owns: "cashbook",
    reads: ["business", "orders"],
    writes: ["cashbook"],
    dependsOn: ["business-profile"],
    paidPath: "platform",
    integrations: [{ with: "browser-pos", ux: "Record end-of-day cash closing automatically" }],
  },
  {
    slug: "appointment-book",
    name: "Appointment Book",
    category: "service",
    kind: "app",
    tier: "foundation",
    status: "built",
    route: "/tools/appointment-book",
    owns: "appointments",
    reads: ["business", "customers"],
    writes: ["appointments", "customers"],
    dependsOn: ["business-profile"],
    paidPath: "clinic",
    integrations: [
      { with: "invoice-generator", ux: "Generate an invoice after the appointment" },
      { with: "queue-management", ux: "Convert a walk-in into an appointment" },
    ],
  },
  {
    slug: "customer-ledger",
    name: "Customer Ledger (Udhaar)",
    category: "customer-management",
    kind: "app",
    tier: "foundation",
    status: "built",
    route: "/tools/customer-ledger",
    owns: "ledger",
    reads: ["business", "customers", "orders"],
    writes: ["ledger", "customers"],
    dependsOn: ["business-profile"],
    paidPath: "retail-pos",
    integrations: [{ with: "browser-pos", ux: "Open a customer's running balance from billing" }],
  },
  {
    slug: "supplier-book",
    name: "Supplier Book",
    category: "customer-management",
    kind: "app",
    tier: "foundation",
    status: "built",
    route: "/tools/supplier-book",
    owns: "suppliers",
    reads: ["business"],
    writes: ["suppliers"],
    dependsOn: ["business-profile"],
    paidPath: "retail-pos",
    integrations: [{ with: "purchase-register", ux: "Reuse supplier details on purchase bills" }],
  },

  // ---- Built today --------------------------------------------------------
  {
    slug: "browser-pos",
    name: "Browser Based POS",
    category: "sales-billing",
    kind: "app",
    tier: "foundation",
    status: "built",
    route: "/products/browser-based-pos",
    owns: "orders",
    reads: ["business", "products", "customers", "receipt_templates", "settings"],
    writes: ["orders", "order_items", "products", "customers", "inventory"],
    dependsOn: [],
    paidPath: "restaurant-pos",
    integrations: [
      { with: "invoice-generator", ux: "Import products into an invoice" },
      { with: "upi-qr-generator", ux: "Accept payment with the business UPI QR" },
      { with: "receipt-designer", ux: "Print bills with a saved receipt template" },
      { with: "customer-ledger", ux: "Open a customer's credit history" },
    ],
  },
  {
    slug: "invoice-generator",
    name: "Invoice Generator",
    category: "sales-billing",
    kind: "app",
    tier: "foundation",
    status: "built",
    route: "/tools/invoice-generator",
    owns: "invoices",
    reads: ["business", "products", "customers"],
    writes: ["invoices", "customers"],
    dependsOn: [],
    paidPath: "retail-pos",
    integrations: [
      { with: "browser-pos", ux: "Import products and customers from the workspace" },
      { with: "gst-calculator", ux: "Calculate GST automatically" },
    ],
  },
  {
    slug: "qr-menu-generator",
    name: "QR Menu Generator",
    category: "restaurant",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/qr-menu-generator",
    reads: ["products", "business"],
    writes: [],
    dependsOn: [],
    paidPath: "restaurant-pos",
    integrations: [{ with: "browser-pos", ux: "Import the menu from workspace products" }],
  },
  {
    slug: "upi-qr-generator",
    name: "UPI QR Generator",
    category: "payments",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/upi-qr-generator",
    reads: ["business"],
    writes: [],
    dependsOn: [],
    paidPath: "platform",
    integrations: [{ with: "browser-pos", ux: "Use the business UPI at checkout" }],
  },
  {
    slug: "gst-calculator",
    name: "GST Calculator",
    category: "finance",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/calculators/gst-calculator",
    reads: [],
    writes: [],
    dependsOn: [],
    paidPath: "platform",
    integrations: [{ with: "invoice-generator", ux: "Drop the computed GST into an invoice" }],
  },

  // ---- Growth -------------------------------------------------------------
  {
    slug: "product-catalog",
    name: "Product Catalog",
    category: "product-management",
    kind: "workspace-surface",
    tier: "growth",
    status: "planned",
    reads: ["products", "categories"],
    writes: ["products", "categories"],
    dependsOn: ["business-profile"],
    paidPath: "retail-pos",
    integrations: [
      { with: "qr-menu-generator", ux: "Menu stays in sync with product updates" },
      { with: "barcode-generator", ux: "Generate a barcode for a product" },
    ],
  },
  {
    slug: "barcode-generator",
    name: "Barcode Generator",
    category: "product-management",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/barcode-generator",
    reads: ["products"],
    writes: [],
    dependsOn: ["product-catalog"],
    paidPath: "retail-pos",
    integrations: [{ with: "label-printer", ux: "Send generated barcodes to the label printer" }],
  },
  {
    slug: "label-printer",
    name: "Barcode Label Printer",
    category: "product-management",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/label-printer",
    reads: ["products"],
    writes: [],
    dependsOn: ["barcode-generator"],
    paidPath: "retail-pos",
    integrations: [{ with: "browser-pos", ux: "Print shelf/price labels for POS products" }],
  },
  {
    slug: "purchase-register",
    name: "Purchase Register",
    category: "inventory",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/purchase-register",
    reads: ["suppliers", "products"],
    writes: ["inventory", "expenses"],
    dependsOn: ["supplier-book", "stock-register"],
    paidPath: "retail-pos",
    integrations: [
      { with: "stock-register", ux: "Update stock from recorded purchases" },
      { with: "expense-tracker", ux: "Optionally log a purchase as a business expense" },
    ],
  },
  {
    slug: "stock-register",
    name: "Stock Register",
    category: "inventory",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/stock-register",
    reads: ["products", "inventory"],
    writes: ["inventory", "products"],
    dependsOn: ["product-catalog"],
    paidPath: "retail-pos",
    integrations: [{ with: "browser-pos", ux: "Shared stock levels with the POS" }],
  },
  {
    slug: "profit-dashboard",
    name: "Profit Dashboard",
    category: "finance",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/profit-dashboard",
    reads: ["orders", "expenses", "products"],
    writes: [],
    dependsOn: ["expense-tracker"],
    paidPath: "platform",
    integrations: [{ with: "expense-tracker", ux: "Uses actual expenses, not estimates" }],
  },

  // ---- Future / Ideas (vocabulary; lighter metadata) ----------------------
  {
    slug: "quotation-generator",
    name: "Quotation Generator",
    category: "sales-billing",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/quotation-generator",
    owns: "quotations",
    reads: ["business", "products", "customers"],
    writes: ["quotations"],
    dependsOn: [],
    paidPath: "retail-pos",
    integrations: [{ with: "invoice-generator", ux: "Convert an accepted quote into an invoice" }],
  },
  {
    slug: "kitchen-order-board",
    name: "Kitchen Order Board",
    category: "restaurant",
    kind: "app",
    tier: "future",
    status: "idea",
    reads: ["orders"],
    writes: ["orders"],
    dependsOn: ["browser-pos"],
    paidPath: "restaurant-pos",
    integrations: [{ with: "browser-pos", ux: "New POS orders appear on the kitchen board" }],
  },

  // ---- Accounting documents ----------------------------------------------
  {
    slug: "credit-note-generator",
    name: "Credit Note Generator",
    category: "documents",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/credit-note-generator",
    owns: "documents",
    reads: ["business", "customers", "products"],
    writes: ["documents"],
    dependsOn: [],
    paidPath: "retail-pos",
    integrations: [
      { with: "invoice-generator", ux: "Raise a credit note against an invoice" },
      { with: "customer-ledger", ux: "Adjust a customer's balance for a return" },
    ],
  },
  {
    slug: "debit-note-generator",
    name: "Debit Note Generator",
    category: "documents",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/debit-note-generator",
    owns: "documents",
    reads: ["business", "suppliers", "products"],
    writes: ["documents"],
    dependsOn: [],
    paidPath: "retail-pos",
    integrations: [
      { with: "purchase-register", ux: "Raise a debit note against a supplier bill" },
      { with: "supplier-book", ux: "Reuse saved supplier details" },
    ],
  },
  {
    slug: "purchase-order-generator",
    name: "Purchase Order Generator",
    category: "documents",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/purchase-order-generator",
    owns: "documents",
    reads: ["business", "suppliers", "products"],
    writes: ["documents"],
    dependsOn: [],
    paidPath: "retail-pos",
    integrations: [
      { with: "supplier-book", ux: "Reuse saved supplier details" },
      { with: "purchase-register", ux: "Turn an accepted PO into a recorded purchase" },
    ],
  },
  {
    slug: "sales-order-generator",
    name: "Sales Order Generator",
    category: "documents",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/sales-order-generator",
    owns: "documents",
    reads: ["business", "customers", "products"],
    writes: ["documents"],
    dependsOn: [],
    paidPath: "retail-pos",
    integrations: [{ with: "invoice-generator", ux: "Convert a confirmed order into an invoice" }],
  },

  // ---- Bookkeeping --------------------------------------------------------
  {
    slug: "chart-of-accounts",
    name: "Chart of Accounts",
    category: "finance",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/chart-of-accounts",
    owns: "coa_accounts",
    reads: ["coa_accounts"],
    writes: ["coa_accounts"],
    dependsOn: [],
    paidPath: "platform",
    integrations: [
      { with: "journal-entry", ux: "Post entries against these accounts" },
      { with: "trial-balance", ux: "Every account rolls up into the trial balance" },
    ],
  },
  {
    slug: "journal-entry",
    name: "Journal Entry",
    category: "finance",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/journal-entry",
    owns: "journal_entries",
    reads: ["coa_accounts", "journal_entries"],
    writes: ["journal_entries"],
    dependsOn: ["chart-of-accounts"],
    paidPath: "platform",
    integrations: [
      { with: "general-ledger", ux: "Postings appear in each account's ledger" },
      { with: "trial-balance", ux: "Entries roll straight into the trial balance" },
    ],
  },
  {
    slug: "general-ledger",
    name: "General Ledger",
    category: "finance",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/general-ledger",
    reads: ["coa_accounts", "journal_entries"],
    writes: [],
    dependsOn: ["journal-entry"],
    paidPath: "platform",
    integrations: [{ with: "journal-entry", ux: "Reads your posted journal entries" }],
  },
  {
    slug: "trial-balance",
    name: "Trial Balance",
    category: "finance",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/trial-balance",
    reads: ["coa_accounts", "journal_entries"],
    writes: [],
    dependsOn: ["journal-entry"],
    paidPath: "platform",
    integrations: [{ with: "journal-entry", ux: "Balances derive from your journal" }],
  },
  {
    slug: "bank-reconciliation",
    name: "Bank Reconciliation",
    category: "finance",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/bank-reconciliation",
    reads: ["business", "cashbook"],
    writes: [],
    dependsOn: [],
    paidPath: "platform",
    integrations: [{ with: "cash-book", ux: "Reconcile against your recorded cash book" }],
  },

  // ---- Statements & reports ----------------------------------------------
  {
    slug: "profit-loss-statement",
    name: "Profit & Loss Statement",
    category: "finance",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/profit-loss-statement",
    reads: ["business", "orders", "expenses", "purchases"],
    writes: [],
    dependsOn: [],
    paidPath: "platform",
    integrations: [
      { with: "browser-pos", ux: "Pull revenue from recorded sales" },
      { with: "expense-tracker", ux: "Pull expenses by category" },
    ],
  },
  {
    slug: "balance-sheet",
    name: "Balance Sheet",
    category: "finance",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/balance-sheet",
    reads: ["business", "cashbook", "ledger"],
    writes: [],
    dependsOn: [],
    paidPath: "platform",
    integrations: [{ with: "customer-ledger", ux: "Pull receivables from outstanding udhaar" }],
  },
  {
    slug: "cash-flow-statement",
    name: "Cash Flow Statement",
    category: "finance",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/cash-flow-statement",
    reads: ["business", "cashbook", "orders", "expenses"],
    writes: [],
    dependsOn: [],
    paidPath: "platform",
    integrations: [{ with: "cash-book", ux: "Pull operating cash from the cash book" }],
  },
  {
    slug: "customer-statement",
    name: "Customer Statement",
    category: "customer-management",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/customer-statement",
    reads: ["business", "customers", "ledger"],
    writes: [],
    dependsOn: [],
    paidPath: "retail-pos",
    integrations: [{ with: "customer-ledger", ux: "Build a statement from ledger transactions" }],
  },
  {
    slug: "invoice-aging-report",
    name: "Invoice Aging Report",
    category: "finance",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/invoice-aging-report",
    reads: ["business", "customers", "ledger"],
    writes: [],
    dependsOn: [],
    paidPath: "retail-pos",
    integrations: [{ with: "customer-ledger", ux: "Pull outstanding balances by customer" }],
  },
  {
    slug: "accounts-payable-aging",
    name: "Accounts Payable Aging",
    category: "finance",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/accounts-payable-aging",
    reads: ["business", "suppliers", "purchases"],
    writes: [],
    dependsOn: [],
    paidPath: "retail-pos",
    integrations: [{ with: "purchase-register", ux: "Pull unpaid bills from purchases" }],
  },

  // ---- Financial analysis -------------------------------------------------
  {
    slug: "budget-vs-actual",
    name: "Budget vs Actual",
    category: "finance",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/budget-vs-actual",
    reads: ["business", "expenses"],
    writes: [],
    dependsOn: [],
    paidPath: "platform",
    integrations: [{ with: "expense-tracker", ux: "Pull actual spend by category" }],
  },
  {
    slug: "abc-analysis",
    name: "ABC Analysis",
    category: "finance",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/abc-analysis",
    reads: ["business", "products"],
    writes: [],
    dependsOn: [],
    paidPath: "retail-pos",
    integrations: [{ with: "stock-register", ux: "Classify the products you stock" }],
  },
  {
    slug: "vendor-comparison",
    name: "Vendor Comparison",
    category: "finance",
    kind: "app",
    tier: "growth",
    status: "built",
    route: "/tools/vendor-comparison",
    reads: ["business", "suppliers"],
    writes: [],
    dependsOn: [],
    paidPath: "retail-pos",
    integrations: [{ with: "supplier-book", ux: "Compare your saved suppliers" }],
  },
  {
    slug: "receipt-ocr",
    name: "Receipt OCR (Bill Scanner)",
    category: "ai",
    kind: "feature",
    tier: "ideas",
    status: "idea",
    reads: ["business"],
    writes: ["expenses"],
    dependsOn: ["expense-tracker"],
    paidPath: "platform",
    integrations: [{ with: "expense-tracker", ux: "Scan a paper bill straight into an expense" }],
  },
];

// ---------------------------------------------------------------------------
// Selectors (used by docs generation and in-app discovery)
// ---------------------------------------------------------------------------

export function getTool(slug: ToolSlug): ToolDescriptor | undefined {
  return TOOLKIT_REGISTRY.find((t) => t.slug === slug);
}

export function toolsByTier(tier: ToolTier): ToolDescriptor[] {
  return TOOLKIT_REGISTRY.filter((t) => t.tier === tier);
}

export function toolsByCategory(category: ToolCategory): ToolDescriptor[] {
  return TOOLKIT_REGISTRY.filter((t) => t.category === category);
}

/**
 * Related tools to surface inside `slug` (the "Suggested tools" panel).
 * Combines this tool's declared integrations with any other tool that names it.
 */
export function suggestedTools(slug: ToolSlug): ToolDescriptor[] {
  const seen = new Set<ToolSlug>();
  const out: ToolDescriptor[] = [];
  const push = (s: ToolSlug) => {
    if (s === slug || seen.has(s)) return;
    const tool = getTool(s);
    if (!tool) return;
    seen.add(s);
    out.push(tool);
  };
  getTool(slug)?.integrations.forEach((i) => push(i.with));
  for (const tool of TOOLKIT_REGISTRY) {
    if (tool.integrations.some((i) => i.with === slug)) push(tool.slug);
  }
  return out;
}

/** Flat integration catalog for Chapter 6 (deduped A↔B pairs). */
export function integrationCatalog(): { a: ToolSlug; b: ToolSlug; ux: string }[] {
  const rows: { a: ToolSlug; b: ToolSlug; ux: string }[] = [];
  for (const tool of TOOLKIT_REGISTRY) {
    for (const i of tool.integrations) {
      rows.push({ a: tool.slug, b: i.with, ux: i.ux });
    }
  }
  return rows;
}
