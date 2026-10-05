import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { ProfitLossTool } from "@/components/tools/statements/ProfitLossTool";

export const metadata: Metadata = toolMetadata("profit-loss-statement");

export default function ProfitLossStatementPage() {
  const item = getToolBySlug("profit-loss-statement")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
    >
      <ProfitLossTool />
    </ToolPageShell>
  );
}
