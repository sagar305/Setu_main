import type { MetadataRoute } from "next";
import {
  getBlogCategories,
  getBlogCategoryUrl,
  getBlogContent,
  getBlogPostUrl,
  getGlossaryTermUrl,
  getGlossaryTerms,
} from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://setutechnology.com";
  const routes = [
    "",
    "/about",
    "/team",
    "/pricing",
    "/sitemap",
    "/products",
    "/products/qr-menu",
    "/products/restaurant-pos",
    "/products/queue",
    "/products/retail",
    "/products/clinic",
    "/consultancy",
    "/calculators",
    "/calculators/gst-calculator",
    "/calculators/profit-margin-calculator",
    "/calculators/markup-calculator",
    "/calculators/break-even-calculator",
    "/calculators/food-cost-calculator",
    "/calculators/discount-calculator",
    "/calculators/loan-emi-calculator",
    "/calculators/table-turnover-calculator",
    "/calculators/take-home-salary-calculator",
    "/calculators/income-tax-calculator",
    "/calculators/gratuity-calculator",
    "/calculators/online-order-commission-calculator",
    "/calculators/online-menu-price-calculator",
    "/calculators/menu-engineering-calculator",
    "/calculators/recipe-costing-calculator",
    "/calculators/liquor-cost-calculator",
    "/calculators/tip-split-calculator",
    "/calculators/inventory-turnover-calculator",
    "/calculators/stock-reorder-point-calculator",
    "/calculators/cac-calculator",
    "/calculators/aov-calculator",
    "/calculators/vat-calculator",
    "/calculators/sales-tax-calculator",
    "/calculators/roi-calculator",
    "/calculators/depreciation-calculator",
    "/calculators/payment-terms-calculator",
    "/calculators/purchase-price-variance-calculator",
    "/calculators/financial-ratio-calculator",
    "/tools",
    "/tools/invoice-generator",
    "/tools/upi-qr-generator",
    "/tools/qr-menu-generator",
    "/tools/business-profile",
    "/tools/receipt-designer",
    "/tools/barcode-generator",
    "/tools/label-printer",
    "/tools/stock-register",
    "/tools/purchase-register",
    "/tools/supplier-book",
    "/tools/expense-tracker",
    "/tools/cash-book",
    "/tools/profit-dashboard",
    "/tools/customer-ledger",
    "/tools/appointment-book",
    "/tools/quotation-generator",
    "/tools/credit-note-generator",
    "/tools/debit-note-generator",
    "/tools/purchase-order-generator",
    "/tools/sales-order-generator",
    "/tools/chart-of-accounts",
    "/tools/journal-entry",
    "/tools/general-ledger",
    "/tools/bank-reconciliation",
    "/tools/trial-balance",
    "/tools/profit-loss-statement",
    "/tools/balance-sheet",
    "/tools/cash-flow-statement",
    "/tools/customer-statement",
    "/tools/invoice-aging-report",
    "/tools/accounts-payable-aging",
    "/tools/budget-vs-actual",
    "/tools/abc-analysis",
    "/tools/vendor-comparison",
    "/products/browser-based-pos",
    "/blog",
    "/glossary",
    "/contact",
    "/book-demo",
  ];

  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.7,
  }));

  // Live QR menu demo. Lives on its own subdomain, so it needs an absolute URL
  // rather than a path appended to `base`.
  const externalEntries: MetadataRoute.Sitemap = [
    {
      url: "https://demo.qr-menu.setutechnology.com/",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  const blogEntries: MetadataRoute.Sitemap = getBlogContent().posts.map((post) => ({
    url: `${base}${getBlogPostUrl(post)}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const categoryEntries: MetadataRoute.Sitemap = getBlogCategories().map((category) => ({
    url: `${base}${getBlogCategoryUrl(category.slug)}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const glossaryEntries: MetadataRoute.Sitemap = getGlossaryTerms().map((term) => ({
    url: `${base}${getGlossaryTermUrl(term.slug)}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [
    ...staticEntries,
    ...externalEntries,
    ...blogEntries,
    ...categoryEntries,
    ...glossaryEntries,
  ];
}
