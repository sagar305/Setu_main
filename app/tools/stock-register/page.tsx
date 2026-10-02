import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { StockRegisterTool } from "@/components/tools/StockRegister/StockRegisterTool";

export const metadata: Metadata = toolMetadata("stock-register");

export default function StockRegisterPage() {
  const item = getToolBySlug("stock-register")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
      schema
      suggested
    >
      <StockRegisterTool />
    </ToolPageShell>
  );
}
