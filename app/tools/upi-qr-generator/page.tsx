import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { UpiQrGeneratorTool } from "@/components/tools/UpiQrGenerator/UpiQrGeneratorTool";

export const metadata: Metadata = toolMetadata("upi-qr-generator");

export default function UpiQrGeneratorPage() {
  const item = getToolBySlug("upi-qr-generator")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
      schema
    >
      <UpiQrGeneratorTool />
    </ToolPageShell>
  );
}
