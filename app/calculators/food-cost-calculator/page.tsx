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
  },
};

export default function FoodCostCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <FoodCostCalculatorTool />
    </CalculatorShell>
  );
}
