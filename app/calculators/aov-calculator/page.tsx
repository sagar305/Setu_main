import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { AovCalculatorTool } from "@/components/calculators/tools/AovCalculatorTool";

const item = getCalculatorBySlug("aov-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/aov-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/aov-calculator",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Setu Technology - Setu for your business",
      },
    ],
  },
};

export default function AovCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <AovCalculatorTool />
    </CalculatorShell>
  );
}
