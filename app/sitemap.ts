import type { MetadataRoute } from "next";
import { getBlogCategories, getBlogCategoryUrl, getBlogContent, getBlogPostUrl } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://setutechnology.com";
  const routes = [
    "",
    "/about",
    "/products",
    "/products/restaurant-pos",
    "/products/queue",
    "/products/retail",
    "/products/clinic",
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
    "/calculators/recipe-costing-calculator",
    "/calculators/liquor-cost-calculator",
    "/calculators/tip-split-calculator",
    "/calculators/inventory-turnover-calculator",
    "/calculators/stock-reorder-point-calculator",
    "/calculators/cac-calculator",
    "/calculators/aov-calculator",
    "/blog",
    "/contact",
    "/book-demo",
  ];

  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.7,
  }));

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

  return [...staticEntries, ...blogEntries, ...categoryEntries];
}
