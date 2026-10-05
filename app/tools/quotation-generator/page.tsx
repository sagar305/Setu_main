import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { QuotationGeneratorTool } from "@/components/tools/QuotationGenerator/QuotationGeneratorTool";

export const metadata: Metadata = toolMetadata("quotation-generator");

export default function QuotationGeneratorPage() {
  const item = getToolBySlug("quotation-generator")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
      schema
      suggested
    >
      <QuotationGeneratorTool />
    </ToolPageShell>
  );
}
