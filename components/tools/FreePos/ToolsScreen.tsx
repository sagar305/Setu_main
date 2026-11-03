"use client";

// Connected tools as tabs inside the POS.
//
// A tool switched on in Settings → Connected tools can also be given its own
// tab in the POS nav ("Show as a tab in the POS", off by default). It then
// runs in place, so the owner never has to leave the POS. The
// tools are the same components their own pages use (components/tools/
// registry), loaded only when their tab is opened.
//
// Two things make that safe:
//   • the POS owns this workspace, so each tool is granted its workspace
//     consent up front instead of showing its "use your POS data?" banner;
//   • the tools write straight to IndexedDB, so the POS reloads its in-memory
//     data when you leave a tool tab (see FreePosApp) — otherwise a sale made
//     afterwards could overwrite stock a tool had just changed.

import { Component, Suspense, useLayoutEffect, useState, type ReactNode } from "react";
import { POS_TOOLS, POS_TOOL_CATEGORIES, isToolEnabled, type PosToolLink } from "@/lib/pos/posTools";
import { TOOL_PAGES } from "@/components/tools/registry";
import { grantConsent } from "@/lib/toolkit/workspace";

/** Screen id of a connected tool's tab. */
export const toolScreenId = (slug: string) => `tool:${slug}` as const;

/** The tool slug behind a screen id, or null for the POS's own screens. */
export const toolSlugOf = (screen: string): string | null =>
  screen.startsWith("tool:") ? screen.slice(5) : null;

/** Whether a connected tool can open inside the POS at all. */
export const canOpenAsTab = (slug: string): boolean => Boolean(TOOL_PAGES[slug]);

/**
 * Connected tools that get a POS tab: switched on, ticked "Show as a tab", and
 * able to run inside the POS — in Settings order.
 */
export function tabTools(connectedTools: string[] | undefined, toolTabs: string[] | undefined): PosToolLink[] {
  return POS_TOOL_CATEGORIES.flatMap((category) =>
    POS_TOOLS.filter(
      (tool) =>
        tool.category === category &&
        isToolEnabled(connectedTools, tool.slug) &&
        (toolTabs ?? []).includes(tool.slug) &&
        canOpenAsTab(tool.slug)
    )
  );
}

class ToolErrorBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {this.props.name} could not open. Your POS data is unaffected — try switching tabs and back.
        </p>
      );
    }
    return this.props.children;
  }
}

/** One connected tool, rendered as a POS screen. */
export function ToolScreen({ tool }: { tool: PosToolLink }) {
  const entry = TOOL_PAGES[tool.slug];
  // Grant consent before the tool's own hooks run, so it loads POS data
  // straight away without asking.
  const [granted, setGranted] = useState(false);
  useLayoutEffect(() => {
    grantConsent(tool.slug);
    setGranted(true);
  }, [tool.slug]);
  if (!entry || !granted) return null;
  const { Tool } = entry;
  const body = <Tool />;
  return (
    <div data-pos-tool={tool.slug}>
      <p className="mb-4 text-sm text-muted">{tool.description}</p>
      <ToolErrorBoundary name={tool.name}>
        {entry.suspense ? <Suspense fallback={null}>{body}</Suspense> : body}
      </ToolErrorBoundary>
    </div>
  );
}
