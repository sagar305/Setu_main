"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useAppFullscreen } from "@/lib/hooks/useAppFullscreen";

/**
 * The TB Analyser is a separate static app, served on this domain at
 * /products/tb-analyzer/app/ by the rewrite in next.config.js. It is framed
 * here so it sits inside the site's header and footer, with the same
 * full-screen toggle as the other free apps.
 *
 * The trailing slash matters: the app loads its scripts by relative path.
 */
const APP_SRC = "/products/tb-analyzer/app/";

export function TbAnalyzerEmbed() {
  const { fullscreen, toggleFullscreen } = useAppFullscreen();

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[60] flex flex-col bg-cream-paper p-2 sm:p-4"
          : "flex flex-col rounded-3xl border border-muted-line/30 bg-cream-paper p-2 shadow-sm sm:p-4"
      }
    >
      {/* The app has its own header, so this row only holds the toggle. */}
      <div className="flex justify-end px-1 pb-2">
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={fullscreen ? "Exit full screen" : "Enter full screen"}
          title={fullscreen ? "Exit full screen" : "Full screen TB Analyser"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-muted-line/40 bg-white text-muted transition hover:border-indigo/40 hover:text-indigo"
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
      <iframe
        src={APP_SRC}
        title="TB Analyser — trial balance analysis"
        className={`w-full rounded-2xl border border-muted-line/30 bg-white ${
          fullscreen ? "min-h-0 flex-1" : "h-[80vh] min-h-[600px]"
        }`}
      />
    </div>
  );
}
