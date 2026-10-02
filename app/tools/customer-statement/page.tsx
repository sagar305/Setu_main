import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { CustomerStatementTool } from "@/components/tools/statements/CustomerStatementTool";

export const metadata: Metadata = toolMetadata("customer-statement");

export default function CustomerStatementPage() {
  const item = getToolBySlug("customer-statement")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
    >
      <CustomerStatementTool />
    </ToolPageShell>
  );
}
