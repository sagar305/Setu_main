import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { DocumentTool } from "@/components/tools/docgen/DocumentTool";

export const metadata: Metadata = toolMetadata("credit-note-generator");

export default function CreditNoteGeneratorPage() {
  const item = getToolBySlug("credit-note-generator")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
    >
      <DocumentTool docType="credit-note" />
    </ToolPageShell>
  );
}
