import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { CustomerLedgerTool } from "@/components/tools/CustomerLedger/CustomerLedgerTool";

export const metadata: Metadata = toolMetadata("customer-ledger");

export default function CustomerLedgerPage() {
  const item = getToolBySlug("customer-ledger")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
      schema
      suggested
    >
      <CustomerLedgerTool />
    </ToolPageShell>
  );
}
