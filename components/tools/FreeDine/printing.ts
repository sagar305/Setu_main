"use client";

// Printing for KOTs and bills.
//
// The markup is cloned into a bare popup window rather than printed through a
// @media print stylesheet on the page. A thermal printer driver takes the page
// width literally, and the surrounding site — nav, footer, Tailwind's preflight
// — leaks margins into an 80mm roll in ways that are miserable to debug on a
// customer's printer. A clean document with one stylesheet prints predictably.

import type { PaperSize } from "@/lib/dine/types";

export const PAPER_WIDTH_MM: Record<PaperSize, number> = {
  "80mm": 80,
  "58mm": 58,
  a4: 210,
};

/** Physical print width, minus the margin thermal printers cannot reach. */
export const PAPER_CONTENT_MM: Record<PaperSize, number> = {
  "80mm": 72,
  "58mm": 50,
  a4: 190,
};

/**
 * The layout rules a receipt document needs, shared by the print iframe and
 * the on-screen preview.
 *
 * These live in one string rather than in Tailwind classes because the print
 * iframe is a bare document with no stylesheet of its own — and because the
 * preview must be styled by the very same rules. When they were only in the
 * iframe, the printed slip was right while the on-screen copy ran together as
 * "Subtotal540.00", which matters: a kitchen with no printer reads the KOT off
 * the screen (FR-5.5).
 */
const DOC_RULES = `
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 1px 0; vertical-align: top; }
  .r { text-align: right; }
  .c { text-align: center; }
  .b { font-weight: 700; }
  .lg { font-size: 15px; }
  .xl { font-size: 19px; }
  .sm { font-size: 10px; }
  .muted { color: #333; }
  .rule { border-top: 1px dashed #000; margin: 4px 0; }
  .solid { border-top: 1px solid #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .wrap { word-break: break-word; }
  ul { margin: 0; padding-left: 14px; }
`;

/** Prefix every selector so the rules cannot leak into the rest of the page. */
function scopeCss(css: string, prefix: string): string {
  return css
    .split("}")
    .map((block) => {
      const [selector, body] = block.split("{");
      if (!body) return "";
      const scoped = selector
        .split(",")
        .map((part) => `${prefix} ${part.trim()}`)
        .join(", ");
      return `${scoped}{${body}}`;
    })
    .join("\n");
}

export const PREVIEW_CLASS = "dine-doc";

/**
 * Stylesheet for the on-screen receipt previews. Rendered once by the app
 * shell, so every preview is styled by the same rules the printer gets.
 */
export function previewStyleSheet(): string {
  return `
    .${PREVIEW_CLASS} {
      background: #fff;
      color: #000;
      font-family: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
      font-size: 12px;
      line-height: 1.45;
    }
    ${scopeCss(DOC_RULES, `.${PREVIEW_CLASS}`)}
  `;
}

function documentStyles(paper: PaperSize): string {
  const width = PAPER_WIDTH_MM[paper];
  const content = PAPER_CONTENT_MM[paper];
  const isRoll = paper !== "a4";

  return `
    @page {
      size: ${isRoll ? `${width}mm auto` : "A4"};
      margin: ${isRoll ? "0" : "12mm"};
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
      font-size: ${isRoll ? "12px" : "13px"};
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body { width: ${content}mm; padding: ${isRoll ? "3mm 2mm" : "0"}; }
    ${DOC_RULES}
  `;
}

/**
 * Print a node's markup as a standalone document.
 *
 * Returns false when the popup was blocked, so the caller can leave the
 * on-screen view up — many small kitchens read the KOT off the screen anyway
 * (FR-5.5), and a silent no-op would look like the app had simply ignored them.
 */
export function printNode(node: HTMLElement | null, paper: PaperSize, title: string): boolean {
  if (!node) return false;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const frameDocument = frame.contentWindow?.document;
  if (!frameDocument) {
    document.body.removeChild(frame);
    return false;
  }

  frameDocument.open();
  frameDocument.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>` +
      `<style>${documentStyles(paper)}</style></head><body>${node.innerHTML}</body></html>`
  );
  frameDocument.close();

  const run = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      // Printing is best-effort; the on-screen copy is still readable.
    }
    // Give the print dialog time to take its snapshot before tearing down.
    window.setTimeout(() => {
      if (frame.parentNode) document.body.removeChild(frame);
    }, 1000);
  };

  if (frameDocument.readyState === "complete") {
    window.setTimeout(run, 50);
  } else {
    frame.onload = () => window.setTimeout(run, 50);
  }
  return true;
}

/** Clock time only, for the kitchen screen's cards. */
export function timeOnly(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Human date/time for a receipt header. */
export function printedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
