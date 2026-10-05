import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { BankReconciliationTool } from "@/components/tools/bookkeeping/BankReconciliationTool";

export const metadata: Metadata = toolMetadata("bank-reconciliation");

export default function BankReconciliationPage() {
  const item = getToolBySlug("bank-reconciliation")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
    >
      <BankReconciliationTool />
    </ToolPageShell>
  );
}
