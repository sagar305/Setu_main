import type { Metadata } from "next";
import { getProductsContent } from "@/lib/content";
import {
  pharmacySoftwareEnabled,
  rentalSoftwareEnabled,
  repairSoftwareEnabled,
  tokenSystemEnabled,
} from "@/lib/featureFlags";
import { languageAlternates } from "@/lib/i18n/pages";
import { ProductsSections } from "@/components/products/ProductsSections";

const content = getProductsContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/products", languages: languageAlternates("products") },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/products",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology - Setu for your business",
      },
      {
        url: "/og/setu-og-image-800x418.png",
        width: 800,
        height: 418,
        alt: "Setu Technology - Setu for your business",
      },
      {
        url: "/og/setu-og-image-500x261.png",
        width: 500,
        height: 261,
        alt: "Setu Technology - Setu for your business",
      },
    ],
  },
};

/**
 * The ItemList, in order, with positions numbered from the list rather than
 * written by hand — an unreleased product appearing or disappearing must not
 * leave a gap or a duplicate in the sequence.
 */
const listedProducts: { name: string; path: string }[] = [
  { name: "Browser Based POS", path: "/products/browser-based-pos" },
  { name: "Free Dine — Free Restaurant POS", path: "/products/free-restaurant-pos" },
  { name: "Setu QR Menu", path: "/products/qr-menu" },
  { name: "Tuition Class Manager", path: "/products/free-tuition-software" },
  { name: "Free Clinic Manager", path: "/products/free-clinic-software" },
  ...(tokenSystemEnabled()
    ? [{ name: "Free Token System", path: "/products/free-token-system" }]
    : []),
  ...(rentalSoftwareEnabled()
    ? [{ name: "Free Rental & Hire Book", path: "/products/free-rental-software" }]
    : []),
  ...(pharmacySoftwareEnabled()
    ? [{ name: "Free Pharmacy POS", path: "/products/free-pharmacy-software" }]
    : []),
  ...(repairSoftwareEnabled()
    ? [{ name: "Free Repair Job Card", path: "/products/free-repair-shop-software" }]
    : []),
  { name: "Setu Dine", path: "/products/restaurant-pos" },
  { name: "Setu Queue", path: "/products/queue" },
  { name: "Setu Retail", path: "/products/retail" },
  { name: "Setu Tuition", path: "/products/tuition" },
  { name: "Setu Clinic", path: "/products/clinic" },
];

const itemListSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: listedProducts.map((product, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: product.name,
    url: `https://setutechnology.com${product.path}`,
  })),
};

export default function ProductsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <ProductsSections content={content} lang="en" />
    </>
  );
}
