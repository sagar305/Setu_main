import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { CacCalculatorTool } from "@/components/calculators/tools/CacCalculatorTool";

const item = getCalculatorBySlug("cac-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/cac-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/cac-calculator",
  },
};

export default function CacCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <CacCalculatorTool />
    </CalculatorShell>
  );
}
