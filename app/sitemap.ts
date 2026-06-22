import type { MetadataRoute } from "next";
import { getBlogCategories, getBlogContent } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://setutechnology.com";
  const routes = [
    "",
    "/about",
    "/products",
    "/products/restaurant-pos",
    "/products/retail",
    "/products/clinic",
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
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const categoryEntries: MetadataRoute.Sitemap = getBlogCategories().map((category) => ({
    url: `${base}/blog/category/${category.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticEntries, ...blogEntries, ...categoryEntries];
}
