import type { Metadata } from "next";
import { getCalculatorsContent } from "@/lib/content";
import { languageAlternates } from "@/lib/i18n/pages";
import { CalculatorsSections } from "@/components/calculators/CalculatorsSections";

const content = getCalculatorsContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/calculators", languages: languageAlternates("calculators") },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/calculators",
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

export default function CalculatorsPage() {
  return <CalculatorsSections content={content} lang="en" />;
}
