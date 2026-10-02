import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { CashFlowTool } from "@/components/tools/statements/CashFlowTool";

export const metadata: Metadata = toolMetadata("cash-flow-statement");

export default function CashFlowStatementPage() {
  const item = getToolBySlug("cash-flow-statement")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
    >
      <CashFlowTool />
    </ToolPageShell>
  );
}
