import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { ChartOfAccountsTool } from "@/components/tools/bookkeeping/ChartOfAccountsTool";

export const metadata: Metadata = toolMetadata("chart-of-accounts");

export default function ChartOfAccountsPage() {
  const item = getToolBySlug("chart-of-accounts")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
    >
      <ChartOfAccountsTool />
    </ToolPageShell>
  );
}
