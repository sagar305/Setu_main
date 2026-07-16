import "server-only";

import siteData from "@/content/en/site.json";
import homeData from "@/content/en/home.json";
import aboutData from "@/content/en/about.json";
import productsData from "@/content/en/products.json";
import blogData from "@/content/en/blog.json";
import contactData from "@/content/en/contact.json";
import restaurantPosData from "@/content/en/restaurant-pos.json";
import queueData from "@/content/en/queue.json";
import retailData from "@/content/en/retail.json";
import clinicData from "@/content/en/clinic.json";
import calculatorsData from "@/content/en/calculators.json";
import toolsData from "@/content/en/tools.json";

export type Cta = { label: string; href: string };

export type SiteContent = typeof siteData;
export type HomeContent = typeof homeData;
export type AboutContent = typeof aboutData;
export type ProductsContent = typeof productsData;
export type BlogContent = typeof blogData;
export type ContactContent = typeof contactData;
export type RestaurantPosContent = typeof restaurantPosData;
export type QueueContent = typeof queueData;
export type RetailContent = typeof retailData;
export type ClinicContent = typeof clinicData;
export type CalculatorsContent = typeof calculatorsData;
export type CalculatorItem = CalculatorsContent["items"][number];
export type ToolsContent = typeof toolsData;
export type ToolItem = ToolsContent["items"][number];

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

export function slugifyCategory(category: string): string {
  return category.toLowerCase().replace(/\s+/g, "-");
}

export function getBlogCategories(): { name: string; slug: string }[] {
  const seen = new Map<string, string>();
  for (const post of blogData.posts) {
    seen.set(slugifyCategory(post.category), post.category);
  }
  return Array.from(seen, ([slug, name]) => ({ slug, name }));
}

export function getBlogPostsByCategorySlug(categorySlug: string): BlogPost[] {
  return blogData.posts.filter((post) => slugifyCategory(post.category) === categorySlug);
}

export function getBlogPostUrl(post: BlogPost): string {
  return `/blog/${slugifyCategory(post.category)}/${post.slug}`;
}

export function getBlogCategoryUrl(categorySlug: string): string {
  return `/blog/${categorySlug}`;
}

export function getContactContent(): ContactContent {
  return contactData;
}

export function getRestaurantPosContent(): RestaurantPosContent {
  return restaurantPosData;
}

export function getQueueContent(): QueueContent {
  return queueData;
}

export function getRetailContent(): RetailContent {
  return retailData;
}

export function getClinicContent(): ClinicContent {
  return clinicData;
}

export function getCalculatorsContent(): CalculatorsContent {
  return calculatorsData;
}

export function getCalculatorBySlug(slug: string): CalculatorItem | undefined {
  return calculatorsData.items.find((item) => item.slug === slug);
}

export function getRelatedCalculators(slug: string, count = 3): CalculatorItem[] {
  const current = getCalculatorBySlug(slug);
  const rest = calculatorsData.items.filter((item) => item.slug !== slug);
  if (!current) return rest.slice(0, count);

  const sameCategory = rest.filter((item) => item.category === current.category);
  const others = rest.filter((item) => item.category !== current.category);
  return [...sameCategory, ...others].slice(0, count);
}

export function getToolsContent(): ToolsContent {
  return toolsData;
}

export function getToolBySlug(slug: string): ToolItem | undefined {
  return toolsData.items.find((item) => item.slug === slug);
}
