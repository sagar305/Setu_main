import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { JournalEntryTool } from "@/components/tools/bookkeeping/JournalEntryTool";

export const metadata: Metadata = toolMetadata("journal-entry");

export default function JournalEntryPage() {
  const item = getToolBySlug("journal-entry")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
    >
      <JournalEntryTool />
    </ToolPageShell>
  );
}
