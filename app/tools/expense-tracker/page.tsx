import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { ExpenseTrackerTool } from "@/components/tools/ExpenseTracker/ExpenseTrackerTool";

export const metadata: Metadata = toolMetadata("expense-tracker");

export default function ExpenseTrackerPage() {
  const item = getToolBySlug("expense-tracker")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
      schema
      suggested
    >
      <ExpenseTrackerTool />
    </ToolPageShell>
  );
}
