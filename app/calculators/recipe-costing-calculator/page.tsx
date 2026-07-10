import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { RecipeCostingCalculatorTool } from "@/components/calculators/tools/RecipeCostingCalculatorTool";

const item = getCalculatorBySlug("recipe-costing-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/recipe-costing-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/recipe-costing-calculator",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Setu Technology - Setu for your business",
      },
    ],
  },
};

export default function RecipeCostingCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <RecipeCostingCalculatorTool />
    </CalculatorShell>
  );
}
