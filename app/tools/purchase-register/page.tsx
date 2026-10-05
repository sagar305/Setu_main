import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { PurchaseRegisterTool } from "@/components/tools/PurchaseRegister/PurchaseRegisterTool";

export const metadata: Metadata = toolMetadata("purchase-register");

export default function PurchaseRegisterPage() {
  const item = getToolBySlug("purchase-register")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
      schema
      suggested
    >
      <PurchaseRegisterTool />
    </ToolPageShell>
  );
}
