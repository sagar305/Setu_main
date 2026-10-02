import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { AbcAnalysisTool } from "@/components/tools/analysis/AbcAnalysisTool";

export const metadata: Metadata = toolMetadata("abc-analysis");

export default function AbcAnalysisPage() {
  const item = getToolBySlug("abc-analysis")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
    >
      <AbcAnalysisTool />
    </ToolPageShell>
  );
}
