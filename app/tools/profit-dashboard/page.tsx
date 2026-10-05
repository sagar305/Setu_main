import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { ProfitDashboardTool } from "@/components/tools/ProfitDashboard/ProfitDashboardTool";

export const metadata: Metadata = toolMetadata("profit-dashboard");

export default function ProfitDashboardPage() {
  const item = getToolBySlug("profit-dashboard")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
      schema
      suggested
    >
      <ProfitDashboardTool />
    </ToolPageShell>
  );
}
