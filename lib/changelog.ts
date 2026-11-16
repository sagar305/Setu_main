// Changelog: what changed on setutechnology.com and in our products, as it
// reaches production (main).
//
// What belongs here: a feature added, an improvement to an existing feature, a
// bug fixed that a user could notice, a product launched. What does not: blog
// posts, glossary terms, SEO copy or metadata changes, translations of existing
// copy, and internal work with no visible effect (refactors, CI, build config).
//
// An entry is added in the same pull request as the change, newest first, dated
// the day the PR is opened. The page reads the code it ships with, so an entry
// only shows on the live site once its change is released from stage to main.
// See "Changelog" in CLAUDE.md.

export type ChangeType = "launch" | "feature" | "improvement" | "fix";

export type ChangelogEntry = {
  /** yyyy-mm-dd */
  date: string;
  type: ChangeType;
  /** Product or area, e.g. "Browser Based POS", "Free Dine", "Website". */
  product: string;
  /** One line, plain language, what a user gets. */
  title: string;
  /** Optional one or two sentences of detail. */
  description?: string;
  /** Optional internal link to where the change can be seen. */
  href?: string;
};

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  launch: "Launch",
  feature: "New feature",
  improvement: "Improvement",
  fix: "Bug fix",
};

/** Newest first. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-11-14",
    type: "improvement",
    product: "Setu Workflow",
    title: "Join the waiting list, with 10 users on every plan",
    description:
      "The Workflow page now takes waiting-list sign-ups in place of a free trial, and every plan includes up to 10 users.",
    href: "/products/workflow",
  },
  {
    date: "2026-11-12",
    type: "feature",
    product: "Setu Retail",
    title: "Live demo of Setu Retail",
    description: "Try Setu Retail from the product page before you buy, on its new app domain.",
    href: "/products/retail",
  },
  {
    date: "2026-11-07",
    type: "feature",
    product: "Setu Workflow",
    title: "Full feature list, roles walkthrough and a contact sales form",
    description:
      "An animated walkthrough shows what each role sees, and teams that need more users can reach sales from the page.",
    href: "/products/workflow",
  },
  {
    date: "2026-11-07",
    type: "feature",
    product: "Setu Retail",
    title: "Full feature tour, plan limits and an enterprise enquiry form",
    href: "/products/retail",
  },
  {
    date: "2026-11-07",
    type: "feature",
    product: "Browser Based POS",
    title: "Choose how many digits your invoice numbers have",
    description: "Set invoice numbers anywhere from 3 to 9 digits long.",
    href: "/products/browser-based-pos",
  },
  {
    date: "2026-11-07",
    type: "fix",
    product: "Website",
    title: "Fixed a site build failure caused by the Sora font download",
  },
  {
    date: "2026-11-05",
    type: "launch",
    product: "Setu Retail",
    title: "Setu Retail launched",
    description: "A new product page for Setu Retail with three plans.",
    href: "/products/retail",
  },
  {
    date: "2026-11-04",
    type: "feature",
    product: "Browser Based POS",
    title: "UPI QR for the exact amount, and split payments",
    description:
      "The bill shows a UPI QR with the amount filled in. Split a bill across cash and UPI and the QR asks only for the balance.",
    href: "/products/browser-based-pos",
  },
  {
    date: "2026-11-03",
    type: "feature",
    product: "Browser Based POS",
    title: "Optional batch and expiry tracking",
    description:
      "Keep stock in batches with their own expiry, cost, selling price and tax. Sales use the earliest expiry first. Off by default.",
    href: "/products/browser-based-pos",
  },
  {
    date: "2026-11-03",
    type: "feature",
    product: "Browser Based POS",
    title: "Purchase returns to suppliers",
    href: "/products/browser-based-pos",
  },
  {
    date: "2026-11-03",
    type: "feature",
    product: "Cash Book",
    title: "Money in and out recorded automatically from the POS and linked tools",
    href: "/tools/cash-book",
  },
  {
    date: "2026-11-03",
    type: "improvement",
    product: "All products",
    title: "Full currency list, with the default picked from your location",
  },
  {
    date: "2026-11-03",
    type: "fix",
    product: "Purchase Register",
    title: "Stock bought is now counted as cost of goods, not as an expense",
    href: "/tools/purchase-register",
  },
  {
    date: "2026-10-31",
    type: "launch",
    product: "Supplier Ledger",
    title: "Supplier Ledger tool launched",
    description: "Track what you owe each supplier. Credit purchases also feed the Accounts Payable Aging report.",
    href: "/tools/supplier-ledger",
  },
  {
    date: "2026-10-31",
    type: "feature",
    product: "Browser Based POS · Free Dine",
    title: "What's new markers for new features inside the apps",
  },
  {
    date: "2026-10-30",
    type: "feature",
    product: "Free Dine",
    title: "Keep a free or premium QR menu in sync with the POS menu",
    description: "The QR menu also shows the POS option groups.",
    href: "/products/free-restaurant-pos",
  },
  {
    date: "2026-10-30",
    type: "fix",
    product: "Clinic Manager",
    title: "Fixed the squeezed name field in prescription and bill rows",
    href: "/products/free-clinic-software",
  },
  {
    date: "2026-10-27",
    type: "fix",
    product: "Free Dine",
    title: "Fixed the dish editor's sizes and add-on rows",
    href: "/products/free-restaurant-pos",
  },
  {
    date: "2026-10-26",
    type: "feature",
    product: "Receipt Designer",
    title: "Choose the tax number label: GSTIN, VAT or TRN",
    href: "/tools/receipt-designer",
  },
  {
    date: "2026-10-25",
    type: "feature",
    product: "Browser Based POS",
    title: "Low stock alert per product, and a stock summary",
    href: "/products/browser-based-pos",
  },
  {
    date: "2026-10-24",
    type: "launch",
    product: "TB Analyser",
    title: "TB Analyser launched as a free product",
    description: "Analyse a trial balance in the browser. It can be installed as a home-screen app.",
    href: "/products/tb-analyzer",
  },
  {
    date: "2026-10-24",
    type: "feature",
    product: "Browser Based POS",
    title: "Record a past sale, or import past sales from CSV or Excel",
    href: "/products/browser-based-pos",
  },
  {
    date: "2026-10-24",
    type: "feature",
    product: "All free apps",
    title: "Install any free product app to your home screen",
  },
  {
    date: "2026-10-24",
    type: "feature",
    product: "Setu QR Menu",
    title: "International payments through PayPal",
    href: "/products/qr-menu",
  },
  {
    date: "2026-10-24",
    type: "fix",
    product: "Tuition Class Manager",
    title: "Fees no longer show as overdue on a student's joining day",
    href: "/products/free-tuition-software",
  },
  {
    date: "2026-10-24",
    type: "fix",
    product: "Free Dine",
    title: "Fixed the squeezed payment method picker in the payment dialog",
    href: "/products/free-restaurant-pos",
  },
  {
    date: "2026-10-24",
    type: "improvement",
    product: "Website",
    title: "A progress bar at the top while the next page loads",
  },
  {
    date: "2026-10-23",
    type: "feature",
    product: "Repair · Rental",
    title: "Full-screen mode for the Repair and Rental apps",
  },
  {
    date: "2026-10-16",
    type: "launch",
    product: "Website",
    title: "Refund and cancellation policy page",
    href: "/refund-policy",
  },
  {
    date: "2026-10-16",
    type: "fix",
    product: "Bank Statement Analyzer",
    title: "Fixed a false balance-break warning",
    href: "/products/bank-statement-analyzer",
  },
  {
    date: "2026-10-13",
    type: "feature",
    product: "Setu QR Menu",
    title: "Buy a Setu QR Menu licence key online",
    description: "The key is emailed to you with a PDF invoice.",
    href: "/products/qr-menu",
  },
  {
    date: "2026-10-11",
    type: "launch",
    product: "Setu Workflow",
    title: "Setu Workflow product page",
    href: "/products/workflow",
  },
  {
    date: "2026-10-10",
    type: "feature",
    product: "Free Dine · Tuition Class Manager",
    title: "Free Dine and the Tuition Class Manager in all 17 languages",
  },
];
