import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Capture a rendered receipt element and download it as a PDF sized like an
 * 80mm thermal receipt (dynamic height). Uses the same html2canvas approach
 * as the invoice generator so currency glyphs (₹) render correctly.
 */
export async function exportReceiptToPdf(
  element: HTMLElement,
  invoiceNumber: string
): Promise<void> {
  if (!element || element.offsetHeight === 0) {
    throw new Error("Receipt is not visible or empty.");
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
    windowWidth: document.documentElement.offsetWidth,
    windowHeight: element.scrollHeight,
  });

  const widthMm = 80;
  const heightMm = (canvas.height * widthMm) / canvas.width;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [widthMm, Math.max(heightMm, 60)],
  });

  pdf.addImage(canvas.toDataURL("image/png", 0.95), "PNG", 0, 0, widthMm, heightMm);
  pdf.save(`Receipt-${invoiceNumber.replace(/[^\w-]+/g, "_")}.pdf`);
}
