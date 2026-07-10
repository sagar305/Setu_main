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

export default function CacCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <CacCalculatorTool />
    </CalculatorShell>
  );
}
