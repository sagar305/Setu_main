import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { CashBookTool } from "@/components/tools/CashBook/CashBookTool";

export const metadata: Metadata = toolMetadata("cash-book");

export default function CashBookPage() {
  const item = getToolBySlug("cash-book")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
      schema
      suggested
    >
      <CashBookTool />
    </ToolPageShell>
  );
}
