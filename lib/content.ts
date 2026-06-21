import "server-only";

import siteData from "@/content/en/site.json";
import homeData from "@/content/en/home.json";
import aboutData from "@/content/en/about.json";
import productsData from "@/content/en/products.json";
import blogData from "@/content/en/blog.json";
import contactData from "@/content/en/contact.json";

export type Cta = { label: string; href: string };

export type SiteContent = typeof siteData;
export type HomeContent = typeof homeData;
export type AboutContent = typeof aboutData;
export type ProductsContent = typeof productsData;
export type BlogContent = typeof blogData;
export type ContactContent = typeof contactData;

export function getSiteContent(): SiteContent {
  return siteData;
}

export function getHomeContent(): HomeContent {
  return homeData;
}

export function getAboutContent(): AboutContent {
  return aboutData;
}

export function getProductsContent(): ProductsContent {
  return productsData;
}

export function getBlogContent(): BlogContent {
  return blogData;
}

export type BlogPost = BlogContent["posts"][number];

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return blogData.posts.find((post) => post.slug === slug);
}

export function getContactContent(): ContactContent {
  return contactData;
}
