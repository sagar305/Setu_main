import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { IncomeTaxCalculatorTool } from "@/components/calculators/tools/IncomeTaxCalculatorTool";

const item = getCalculatorBySlug("income-tax-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/income-tax-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/income-tax-calculator",
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

export default function IncomeTaxCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <IncomeTaxCalculatorTool />
    </CalculatorShell>
  );
}
