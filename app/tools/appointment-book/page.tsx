import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { AppointmentBookTool } from "@/components/tools/AppointmentBook/AppointmentBookTool";

export const metadata: Metadata = toolMetadata("appointment-book");

export default function AppointmentBookPage() {
  const item = getToolBySlug("appointment-book")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
      schema
      suggested
    >
      <AppointmentBookTool />
    </ToolPageShell>
  );
}
