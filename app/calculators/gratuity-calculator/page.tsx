import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { GratuityCalculatorTool } from "@/components/calculators/tools/GratuityCalculatorTool";

const item = getCalculatorBySlug("gratuity-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/gratuity-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/gratuity-calculator",
  },
};

export default function GratuityCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <GratuityCalculatorTool />
    </CalculatorShell>
  );
}
