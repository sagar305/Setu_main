import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { OnlineOrderCommissionCalculatorTool } from "@/components/calculators/tools/OnlineOrderCommissionCalculatorTool";

const item = getCalculatorBySlug("online-order-commission-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/online-order-commission-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/online-order-commission-calculator",
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

export default function OnlineOrderCommissionCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <OnlineOrderCommissionCalculatorTool />
    </CalculatorShell>
  );
}
