import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { MarkupCalculatorTool } from "@/components/calculators/tools/MarkupCalculatorTool";

const item = getCalculatorBySlug("markup-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/markup-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/markup-calculator",
  },
};

export default function MarkupCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <MarkupCalculatorTool />
    </CalculatorShell>
  );
}
