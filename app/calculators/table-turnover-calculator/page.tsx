import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { TableTurnoverCalculatorTool } from "@/components/calculators/tools/TableTurnoverCalculatorTool";

const item = getCalculatorBySlug("table-turnover-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/table-turnover-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/table-turnover-calculator",
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

export default function TableTurnoverCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <TableTurnoverCalculatorTool />
    </CalculatorShell>
  );
}
