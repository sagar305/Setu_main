import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { getInvoiceFileName } from "@/lib/invoice";
import type { InvoiceData } from "@/lib/types/invoice";

// Detects an all-white/empty capture so we fail loudly instead of
// silently producing a blank PDF. Samples a downscaled copy for speed.
function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  const sample = document.createElement("canvas");
  sample.width = 40;
  sample.height = 40;
  const ctx = sample.getContext("2d");
  if (!ctx) return false;

  ctx.drawImage(canvas, 0, 0, sample.width, sample.height);
  const { data } = ctx.getImageData(0, 0, sample.width, sample.height);
  for (let i = 0; i < data.length; i += 4) {
    const isOpaque = data[i + 3] > 0;
    const isNonWhite = data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250;
    if (isOpaque && isNonWhite) {
      return false;
    }
  }
  return true;
}

export async function exportInvoiceToPdf(
  data: InvoiceData,
  element: HTMLElement,
  options?: {
    scale?: number;
    quality?: number;
  }
) {
  try {
    const scale = options?.scale || 2;
    const quality = options?.quality || 0.95;

    // Wait for any dynamic content (like QR codes) to render
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check if element is visible and has content
    if (!element || element.offsetHeight === 0) {
      throw new Error("Invoice preview is not visible or empty");
    }

    // Capture the invoice element as canvas.
    // Note: foreignObjectRendering must stay OFF — it renders blank
    // canvases on iOS/Safari (WebKit). Scroll offsets are compensated so
    // captures work when the preview is scrolled out of view on mobile.
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
      windowWidth: document.documentElement.offsetWidth,
      windowHeight: element.scrollHeight,
    });

    if (!canvas || isCanvasBlank(canvas)) {
      throw new Error("Failed to capture invoice preview");
    }

    // Get canvas dimensions
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Create PDF
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Add image to PDF
    const imgData = canvas.toDataURL("image/png", quality);
    let heightLeft = imgHeight;
    let position = 0;

    // Add first page
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= 297; // A4 height in mm

    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= 297;
    }

    // Download PDF
    const fileName = getInvoiceFileName(data.invoiceDetails.number, data.invoiceDetails.date);
    pdf.save(fileName);

    return true;
  } catch (error) {
    console.error("Error generating PDF:", error);
    const message = error instanceof Error ? error.message : "Failed to generate PDF";
    throw new Error(message || "Failed to generate PDF. Please try again.");
  }
}

export async function generateInvoicePdfBlob(
  data: InvoiceData,
  element: HTMLElement,
  options?: {
    scale?: number;
    quality?: number;
  }
): Promise<Blob | null> {
  try {
    const scale = options?.scale || 2;
    const quality = options?.quality || 0.95;

    // Check if element is visible and has content
    if (!element || element.offsetHeight === 0) {
      throw new Error("Invoice preview is not visible or empty");
    }

    // Capture the invoice element as canvas. No artificial delay here —
    // navigator.share() must run within the user-activation window, so
    // this path has to stay as fast as possible.
    // Note: foreignObjectRendering must stay OFF — it renders blank
    // canvases on iOS/Safari (WebKit). Scroll offsets are compensated so
    // captures work when the preview is scrolled out of view on mobile.
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
      windowWidth: document.documentElement.offsetWidth,
      windowHeight: element.scrollHeight,
    });

    if (!canvas || isCanvasBlank(canvas)) {
      throw new Error("Failed to capture invoice preview");
    }

    // Get canvas dimensions
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Create PDF
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Add image to PDF
    const imgData = canvas.toDataURL("image/png", quality);
    let heightLeft = imgHeight;
    let position = 0;

    // Add first page
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= 297; // A4 height in mm

    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= 297;
    }

    return pdf.output("blob");
  } catch (error) {
    console.error("Error generating PDF blob:", error);
    return null;
  }
}
