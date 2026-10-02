import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { AgingReportTool } from "@/components/tools/aging/AgingReportTool";

export const metadata: Metadata = toolMetadata("accounts-payable-aging");

export default function AccountsPayableAgingPage() {
  const item = getToolBySlug("accounts-payable-aging")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
    >
      <AgingReportTool kind="payable" />
    </ToolPageShell>
  );
}
