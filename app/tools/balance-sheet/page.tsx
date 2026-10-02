import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { BalanceSheetTool } from "@/components/tools/statements/BalanceSheetTool";

export const metadata: Metadata = toolMetadata("balance-sheet");

export default function BalanceSheetPage() {
  const item = getToolBySlug("balance-sheet")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
    >
      <BalanceSheetTool />
    </ToolPageShell>
  );
}
