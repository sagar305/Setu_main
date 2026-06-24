import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { LoanEmiCalculatorTool } from "@/components/calculators/tools/LoanEmiCalculatorTool";

const item = getCalculatorBySlug("loan-emi-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/loan-emi-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/loan-emi-calculator",
  },
};

export default function LoanEmiCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <LoanEmiCalculatorTool />
    </CalculatorShell>
  );
}
