import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { TrialBalanceTool } from "@/components/tools/bookkeeping/TrialBalanceTool";

export const metadata: Metadata = toolMetadata("trial-balance");

export default function TrialBalancePage() {
  const item = getToolBySlug("trial-balance")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
    >
      <TrialBalanceTool />
    </ToolPageShell>
  );
}
