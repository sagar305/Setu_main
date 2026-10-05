import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { InvoiceGeneratorTool } from "@/components/tools/InvoiceGenerator/InvoiceGeneratorTool";

export const metadata: Metadata = toolMetadata("invoice-generator");

export default function InvoiceGeneratorPage() {
  const item = getToolBySlug("invoice-generator")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
      schema
    >
      <InvoiceGeneratorTool />
    </ToolPageShell>
  );
}
