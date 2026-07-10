import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { TakeHomeSalaryCalculatorTool } from "@/components/calculators/tools/TakeHomeSalaryCalculatorTool";

const item = getCalculatorBySlug("take-home-salary-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/take-home-salary-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/take-home-salary-calculator",
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

export default function TakeHomeSalaryCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <TakeHomeSalaryCalculatorTool />
    </CalculatorShell>
  );
}
