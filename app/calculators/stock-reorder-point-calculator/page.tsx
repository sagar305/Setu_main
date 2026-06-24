import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { StockReorderPointCalculatorTool } from "@/components/calculators/tools/StockReorderPointCalculatorTool";

const item = getCalculatorBySlug("stock-reorder-point-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/stock-reorder-point-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/stock-reorder-point-calculator",
  },
};

export default function StockReorderPointCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <StockReorderPointCalculatorTool />
    </CalculatorShell>
  );
}
