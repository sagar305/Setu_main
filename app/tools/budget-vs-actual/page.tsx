import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { BudgetVsActualTool } from "@/components/tools/analysis/BudgetVsActualTool";

export const metadata: Metadata = toolMetadata("budget-vs-actual");

export default function BudgetVsActualPage() {
  const item = getToolBySlug("budget-vs-actual")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
    >
      <BudgetVsActualTool />
    </ToolPageShell>
  );
}
