import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { ReceiptDesignerTool } from "@/components/tools/ReceiptDesigner/ReceiptDesignerTool";

export const metadata: Metadata = toolMetadata("receipt-designer");

export default function ReceiptDesignerPage() {
  const item = getToolBySlug("receipt-designer")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
      schema
      suggested
    >
      <ReceiptDesignerTool />
    </ToolPageShell>
  );
}
