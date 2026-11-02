import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { SupplierLedgerTool } from "@/components/tools/SupplierLedger/SupplierLedgerTool";

export const metadata: Metadata = toolMetadata("supplier-ledger");

export default function SupplierLedgerPage() {
  const item = getToolBySlug("supplier-ledger")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
      schema
      suggested
    >
      <SupplierLedgerTool />
    </ToolPageShell>
  );
}
