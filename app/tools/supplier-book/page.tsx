import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { SupplierBookTool } from "@/components/tools/SupplierBook/SupplierBookTool";

export const metadata: Metadata = toolMetadata("supplier-book");

export default function SupplierBookPage() {
  const item = getToolBySlug("supplier-book")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
      schema
      suggested
    >
      <SupplierBookTool />
    </ToolPageShell>
  );
}
