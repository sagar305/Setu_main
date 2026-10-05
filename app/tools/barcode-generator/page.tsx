import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { BarcodeGeneratorTool } from "@/components/tools/BarcodeGenerator/BarcodeGeneratorTool";

export const metadata: Metadata = toolMetadata("barcode-generator");

export default function BarcodeGeneratorPage() {
  const item = getToolBySlug("barcode-generator")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
      schema
      suggested
    >
      <BarcodeGeneratorTool />
    </ToolPageShell>
  );
}
