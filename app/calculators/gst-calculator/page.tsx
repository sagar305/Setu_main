import type { Metadata } from "next";
import { getCalculatorBySlug } from "@/lib/content";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { GstCalculatorTool } from "@/components/calculators/tools/GstCalculatorTool";

const item = getCalculatorBySlug("gst-calculator")!;

export const metadata: Metadata = {
  title: item.seo.title,
  description: item.seo.description,
  keywords: item.seo.keywords,
  alternates: { canonical: "/calculators/gst-calculator" },
  openGraph: {
    title: item.seo.title,
    description: item.seo.description,
    url: "/calculators/gst-calculator",
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

export default function GstCalculatorPage() {
  return (
    <CalculatorShell item={item}>
      <GstCalculatorTool />
    </CalculatorShell>
  );
}
