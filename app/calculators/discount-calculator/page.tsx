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

export default function DiscountCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <DiscountCalculatorTool />
    </CalculatorShell>
  );
}
