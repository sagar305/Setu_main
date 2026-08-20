// Printed output: the token slip and the QR poster.
//
// Both print through a hidden iframe rather than a new window, the same way
// the clinic's prescriptions do — a popup blocker cannot swallow it, and the
// page the receptionist is standing in front of never navigates away.
//
// The slip is the only thing most customers will hold, so the number on it is
// enormous and everything else is small. Someone squinting at a slip from a
// chair across the room needs one thing off it.

import QRCode from "qrcode";
import { escapeHtml } from "@/lib/clinic/print";
import { formatWait } from "./calc";
import { tokenLabel, type Service, type Token } from "./types";

export type QueuePaper = "58mm" | "a4";

function documentStyles(paper: QueuePaper): string {
  const page =
    paper === "58mm"
      ? "@page { size: 58mm auto; margin: 3mm; }"
      : "@page { size: A4 portrait; margin: 14mm; }";
  return `
    ${page}
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Sora", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #0E1124;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .slip { width: ${paper === "58mm" ? "52mm" : "100%"}; }
    .center { text-align: center; }
    .muted { color: #5F6478; }
    .business { font-size: 12px; font-weight: 700; letter-spacing: .02em; }
    .service { font-size: 11px; margin-top: 2mm; }
    .token {
      font-size: 46px;
      font-weight: 800;
      line-height: 1;
      margin: 3mm 0 2mm;
      letter-spacing: -.02em;
    }
    .wait { font-size: 12px; font-weight: 600; }
    .meta { font-size: 10px; margin-top: 3mm; line-height: 1.5; }
    .rule { border-top: 1px dashed #B7AE99; margin: 3mm 0; }
    .priority {
      display: inline-block;
      border: 1px solid #0E1124;
      border-radius: 3px;
      padding: 0 2mm;
      font-size: 10px;
      font-weight: 700;
      margin-top: 2mm;
    }
    .poster { text-align: center; }
    .poster h1 { font-size: 40px; margin: 0 0 6mm; letter-spacing: -.02em; }
    .poster .lead { font-size: 20px; margin: 0 0 10mm; color: #5F6478; }
    .poster img { width: 90mm; height: 90mm; }
    .poster ol {
      display: inline-block;
      text-align: left;
      font-size: 16px;
      line-height: 1.9;
      margin: 10mm 0 0;
      padding-left: 6mm;
    }
    .poster .foot { margin-top: 12mm; font-size: 13px; color: #5F6478; }
  `;
}

/** Render HTML in a hidden frame and open the print dialog on it. */
export function printHtml(html: string, paper: QueuePaper, title: string): boolean {
  if (typeof document === "undefined") return false;

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
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
      `<style>${documentStyles(paper)}</style></head><body>${html}</body></html>`
  );
  frameDocument.close();

  const run = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      // Printing is best-effort; nothing on screen depends on it working.
    }
    window.setTimeout(() => {
      if (frame.parentNode) document.body.removeChild(frame);
    }, 1000);
  };

  if (frameDocument.readyState === "complete") window.setTimeout(run, 50);
  else frame.onload = () => window.setTimeout(run, 50);
  return true;
}

export type SlipContext = {
  token: Token;
  service: Service | undefined;
  businessName: string;
  waitMinutes: number;
};

export function buildSlipHtml(ctx: SlipContext): string {
  const issued = new Date(ctx.token.issuedAt).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `
    <div class="slip center">
      <div class="business">${escapeHtml(ctx.businessName || "Token")}</div>
      <div class="service muted">${escapeHtml(ctx.service?.name ?? "")}</div>
      <div class="token">${escapeHtml(tokenLabel(ctx.token, ctx.service))}</div>
      <div class="wait">${escapeHtml(formatWait(ctx.waitMinutes))}</div>
      ${ctx.token.priority ? '<div class="priority">PRIORITY</div>' : ""}
      <div class="rule"></div>
      <div class="meta muted">
        Issued ${escapeHtml(issued)}<br />
        ${ctx.token.customerName ? `${escapeHtml(ctx.token.customerName)}<br />` : ""}
        Please watch the screen for your number.
      </div>
    </div>
  `;
}

export function printTokenSlip(ctx: SlipContext): boolean {
  return printHtml(buildSlipHtml(ctx), "58mm", `Token ${tokenLabel(ctx.token, ctx.service)}`);
}

export type PosterContext = {
  businessName: string;
  serviceName: string;
  url: string;
  qrDataUrl: string;
};

/**
 * The QR poster.
 *
 * In the free app the code does not issue anything — two devices cannot share
 * one browser's IndexedDB, and pretending otherwise would put a customer in
 * front of a screen that says they are seventh in a queue that does not exist
 * on this phone. It opens a page that tells them what to do instead: show it
 * at the counter. A live version would need a server the two devices share, so
 * the poster states what this one actually does rather than hiding it.
 */
export function buildPosterHtml(ctx: PosterContext): string {
  return `
    <div class="poster">
      <h1>${escapeHtml(ctx.businessName || "Join the queue")}</h1>
      <p class="lead">${escapeHtml(ctx.serviceName)}</p>
      <img src="${ctx.qrDataUrl}" alt="QR code" />
      <ol>
        <li>Scan this code with your phone camera.</li>
        <li>Show the screen that opens to our counter.</li>
        <li>We will hand you your token number.</li>
      </ol>
      <div class="foot">${escapeHtml(ctx.url)}</div>
    </div>
  `;
}

export async function printQrPoster(
  context: Omit<PosterContext, "qrDataUrl">
): Promise<boolean> {
  const qrDataUrl = await QRCode.toDataURL(context.url, {
    width: 900,
    margin: 1,
    errorCorrectionLevel: "H",
  });
  return printHtml(
    buildPosterHtml({ ...context, qrDataUrl }),
    "a4",
    `${context.businessName} — queue poster`
  );
}
