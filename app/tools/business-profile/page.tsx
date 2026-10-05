import type { Metadata } from "next";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { BusinessProfileTool } from "@/components/tools/BusinessProfile/BusinessProfileTool";

export const metadata: Metadata = toolMetadata("business-profile");

export default function BusinessProfilePage() {
  const item = getToolBySlug("business-profile")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
      schema
      suggested
    >
      <BusinessProfileTool />
    </ToolPageShell>
  );
}
