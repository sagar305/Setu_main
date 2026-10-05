import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { GeneralLedgerTool } from "@/components/tools/bookkeeping/GeneralLedgerTool";

export const metadata: Metadata = toolMetadata("general-ledger");

export default function GeneralLedgerPage() {
  const item = getToolBySlug("general-ledger")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
    >
      <GeneralLedgerTool />
    </ToolPageShell>
  );
}
