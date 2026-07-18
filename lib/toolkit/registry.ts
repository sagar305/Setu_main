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
    status: "next",
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
    name: "Receipt Designer",
    category: "sales-billing",
    kind: "app",
    tier: "foundation",
    status: "next",
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
    status: "next",
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
    status: "next",
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
    status: "next",
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
    status: "next",
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
    status: "planned",
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
    status: "planned",
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
    status: "planned",
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
    status: "planned",
    route: "/tools/purchase-register",
    reads: ["suppliers", "products"],
    writes: ["inventory", "expenses"],
    dependsOn: ["supplier-book", "stock-register"],
    paidPath: "retail-pos",
    integrations: [{ with: "stock-register", ux: "Update stock from recorded purchases" }],
  },
  {
    slug: "stock-register",
    name: "Stock Register",
    category: "inventory",
    kind: "app",
    tier: "growth",
    status: "planned",
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
    status: "planned",
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
    tier: "future",
    status: "idea",
    reads: ["business", "products", "customers"],
    writes: [],
    dependsOn: ["invoice-generator"],
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
