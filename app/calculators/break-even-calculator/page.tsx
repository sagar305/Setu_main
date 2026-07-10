import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { BreakEvenCalculatorTool } from "@/components/calculators/tools/BreakEvenCalculatorTool";

const item = getCalculatorBySlug("break-even-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/break-even-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/break-even-calculator",
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

export default function BreakEvenCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <BreakEvenCalculatorTool />
    </CalculatorShell>
  );
}
