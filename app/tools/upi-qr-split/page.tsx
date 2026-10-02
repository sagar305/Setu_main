import type { Metadata } from "next";
import { Suspense } from "react";
import { getToolBySlug, getToolsContent } from "@/lib/content";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { UpiQrSplitTool } from "@/components/tools/UpiQrSplit/UpiQrSplitTool";

export const metadata: Metadata = toolMetadata("upi-qr-split");

export default function UpiQrSplitPage() {
  const item = getToolBySlug("upi-qr-split")!;
  const labels = getToolsContent().labels;

  return (
    <ToolPageShell
      item={item}
      eyebrow={labels.freeTool}
      schema
    >
      <Suspense
        fallback={
          <div className="rounded-2xl border border-dashed border-muted-line/40 bg-cream p-10 text-center text-muted">
            {labels.loading}
          </div>
        }
      >
        <UpiQrSplitTool />
      </Suspense>
    </ToolPageShell>
  );
}
