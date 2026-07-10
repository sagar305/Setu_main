import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { MenuEngineeringCalculatorTool } from "@/components/calculators/tools/MenuEngineeringCalculatorTool";

const item = getCalculatorBySlug("menu-engineering-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/menu-engineering-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/menu-engineering-calculator",
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

export default function MenuEngineeringCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <MenuEngineeringCalculatorTool />
    </CalculatorShell>
  );
}
