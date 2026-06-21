import type { MetadataRoute } from "next";
import { getBlogContent } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://setutech.com";
  const routes = ["", "/about", "/products", "/blog", "/contact"];

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

  return [...staticEntries, ...blogEntries];
}
