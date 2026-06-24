import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { ProfitMarginCalculatorTool } from "@/components/calculators/tools/ProfitMarginCalculatorTool";

const item = getCalculatorBySlug("profit-margin-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/profit-margin-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/profit-margin-calculator",
  },
};

export default function ProfitMarginCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <ProfitMarginCalculatorTool />
    </CalculatorShell>
  );
}
