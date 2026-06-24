import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { OnlineMenuPriceCalculatorTool } from "@/components/calculators/tools/OnlineMenuPriceCalculatorTool";

const item = getCalculatorBySlug("online-menu-price-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/online-menu-price-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/online-menu-price-calculator",
  },
};

export default function OnlineMenuPriceCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <OnlineMenuPriceCalculatorTool />
    </CalculatorShell>
  );
}
