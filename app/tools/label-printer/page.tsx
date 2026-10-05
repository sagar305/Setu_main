import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { LabelPrinterTool } from "@/components/tools/LabelPrinter/LabelPrinterTool";

export const metadata: Metadata = toolMetadata("label-printer");

export default function LabelPrinterPage() {
  const item = getToolBySlug("label-printer")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
      schema
      suggested
    >
      <LabelPrinterTool />
    </ToolPageShell>
  );
}
