import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { QrMenuGeneratorTool } from "@/components/tools/QrMenuGenerator/QrMenuGeneratorTool";

export const metadata: Metadata = toolMetadata("qr-menu-generator");

export default function QrMenuGeneratorPage() {
  const item = getToolBySlug("qr-menu-generator")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
      schema
    >
      <QrMenuGeneratorTool />
    </ToolPageShell>
  );
}
