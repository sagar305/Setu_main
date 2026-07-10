import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { LiquorCostCalculatorTool } from "@/components/calculators/tools/LiquorCostCalculatorTool";

const item = getCalculatorBySlug("liquor-cost-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/liquor-cost-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/liquor-cost-calculator",
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

export default function LiquorCostCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <LiquorCostCalculatorTool />
    </CalculatorShell>
  );
}
