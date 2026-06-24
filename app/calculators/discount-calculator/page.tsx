import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { DiscountCalculatorTool } from "@/components/calculators/tools/DiscountCalculatorTool";

const item = getCalculatorBySlug("discount-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/discount-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/discount-calculator",
  },
};

export default function DiscountCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <DiscountCalculatorTool />
    </CalculatorShell>
  );
}
