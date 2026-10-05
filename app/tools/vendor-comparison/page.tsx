import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { VendorComparisonTool } from "@/components/tools/analysis/VendorComparisonTool";

export const metadata: Metadata = toolMetadata("vendor-comparison");

export default function VendorComparisonPage() {
  const item = getToolBySlug("vendor-comparison")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
    >
      <VendorComparisonTool />
    </ToolPageShell>
  );
}
