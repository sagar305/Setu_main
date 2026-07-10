import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { FoodCostCalculatorTool } from "@/components/calculators/tools/FoodCostCalculatorTool";

const item = getCalculatorBySlug("food-cost-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/food-cost-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/food-cost-calculator",
    images: [
      {
        url: "/og/setu-og-image.png",
        width: 1200,
        height: 630,
        alt: "Setu Technology - Setu for your business",
      },
    ],
  },
};

export default function FoodCostCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <FoodCostCalculatorTool />
    </CalculatorShell>
  );
}
