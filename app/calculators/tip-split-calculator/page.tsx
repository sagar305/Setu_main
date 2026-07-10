import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { TipSplitCalculatorTool } from "@/components/calculators/tools/TipSplitCalculatorTool";

const item = getCalculatorBySlug("tip-split-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/tip-split-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/tip-split-calculator",
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

export default function TipSplitCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <TipSplitCalculatorTool />
    </CalculatorShell>
  );
}
